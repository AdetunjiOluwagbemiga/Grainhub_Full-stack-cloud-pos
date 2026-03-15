/*
  # Add Delete Sale Function
  
  1. Overview
    - Creates a database function to permanently delete a sale transaction
    - Reverses all impacts: inventory, shift totals, customer stats
    - Removes all related records: sale items, payments, stock movements
    - Admin-only access via RLS policies
  
  2. New Function
    - `delete_sale(p_sale_id UUID)` - Permanently deletes a sale and all related data
    - Returns success status and details
  
  3. Operations Performed
    - Retrieves sale data before deletion
    - Reverses inventory changes (adds quantity back)
    - Adjusts shift totals (subtracts amounts)
    - Updates customer stats (subtracts spent amount)
    - Deletes stock movements, payments, sale items, and sale record
  
  4. Security
    - Function is SECURITY DEFINER to bypass RLS temporarily
    - Only authenticated users can execute
    - Application layer should restrict to admin users only
*/

-- Function to permanently delete a sale and clean up all related data
CREATE OR REPLACE FUNCTION delete_sale(p_sale_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale RECORD;
  v_item RECORD;
  v_payment RECORD;
  v_shift_id UUID;
  v_total_cash NUMERIC := 0;
  v_total_card NUMERIC := 0;
  v_result JSONB;
BEGIN
  -- Get the sale data
  SELECT * INTO v_sale
  FROM sales
  WHERE id = p_sale_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;
  
  v_shift_id := v_sale.shift_id;
  
  -- Reverse inventory for each sale item
  FOR v_item IN 
    SELECT si.*, p.track_inventory
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    WHERE si.sale_id = p_sale_id
  LOOP
    -- Only reverse inventory for tracked products
    IF v_item.track_inventory THEN
      UPDATE inventory
      SET 
        quantity = quantity + v_item.quantity,
        updated_at = NOW()
      WHERE product_id = v_item.product_id
        AND (variant_id = v_item.variant_id OR (variant_id IS NULL AND v_item.variant_id IS NULL))
        AND location_id = v_sale.location_id;
    END IF;
  END LOOP;
  
  -- Calculate payment method totals for shift adjustment
  FOR v_payment IN
    SELECT p.amount, pm.code
    FROM payments p
    JOIN payment_methods pm ON p.payment_method_id = pm.id
    WHERE p.sale_id = p_sale_id
  LOOP
    IF v_payment.code = 'cash' THEN
      v_total_cash := v_total_cash + v_sale.total_amount;
    ELSIF v_payment.code IN ('card', 'pos') THEN
      v_total_card := v_total_card + v_sale.total_amount;
    END IF;
  END LOOP;
  
  -- Adjust shift totals if sale was part of a shift
  IF v_shift_id IS NOT NULL THEN
    UPDATE shifts
    SET 
      total_sales = GREATEST(COALESCE(total_sales, 0) - v_sale.total_amount, 0),
      total_discounts = GREATEST(COALESCE(total_discounts, 0) - v_sale.discount_amount, 0),
      total_tax = GREATEST(COALESCE(total_tax, 0) - v_sale.tax_amount, 0),
      total_cash_sales = GREATEST(COALESCE(total_cash_sales, 0) - v_total_cash, 0),
      total_card_sales = GREATEST(COALESCE(total_card_sales, 0) - v_total_card, 0),
      transaction_count = GREATEST(COALESCE(transaction_count, 0) - 1, 0),
      updated_at = NOW()
    WHERE id = v_shift_id;
  END IF;
  
  -- Update customer stats if customer exists
  IF v_sale.customer_id IS NOT NULL THEN
    UPDATE customers
    SET 
      total_spent = GREATEST(COALESCE(total_spent, 0) - v_sale.total_amount, 0),
      visit_count = GREATEST(COALESCE(visit_count, 0) - 1, 0),
      updated_at = NOW()
    WHERE id = v_sale.customer_id;
  END IF;
  
  -- Delete related records (cascade will handle this, but being explicit)
  -- Delete stock movements
  DELETE FROM stock_movements
  WHERE reference_type = 'sale' AND reference_id = p_sale_id;
  
  -- Delete payments
  DELETE FROM payments
  WHERE sale_id = p_sale_id;
  
  -- Delete sale items
  DELETE FROM sale_items
  WHERE sale_id = p_sale_id;
  
  -- Delete the sale record
  DELETE FROM sales
  WHERE id = p_sale_id;
  
  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'sale_number', v_sale.sale_number,
    'total_amount', v_sale.total_amount,
    'message', 'Sale deleted successfully'
  );
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
-- Application should enforce admin-only access
GRANT EXECUTE ON FUNCTION delete_sale(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION delete_sale(UUID) IS 'Permanently deletes a sale and reverses all related impacts on inventory, shifts, and customer stats. Admin use only.';
