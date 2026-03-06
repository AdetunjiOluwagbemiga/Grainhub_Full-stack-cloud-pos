/*
  # Fix Complete Sale Status Type Casting v2
  
  ## Overview
  The complete_sale function needs proper type casting for the status field
  to convert text to sale_status enum type.
  
  ## Changes
  1. Drop the existing complete_sale function
  2. Recreate it with proper ::sale_status casting on the status field
  
  ## Technical Details
  - Changes line 84: COALESCE((p_sale->>'status')::sale_status, 'completed'::sale_status)
  - All other functionality remains unchanged
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS complete_sale(JSONB, JSONB, JSONB, UUID);

-- Recreate with proper type casting
CREATE OR REPLACE FUNCTION complete_sale(
  p_sale JSONB,
  p_items JSONB,
  p_payments JSONB,
  p_location_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id UUID;
  v_sale_number TEXT;
  v_location_id UUID;
  v_item JSONB;
  v_payment JSONB;
  v_total_cost NUMERIC := 0;
  v_total_profit NUMERIC := 0;
  v_result JSONB;
  v_current_stock NUMERIC;
  v_required_qty NUMERIC;
BEGIN
  -- Get location_id
  IF p_location_id IS NULL THEN
    SELECT id INTO v_location_id
    FROM locations
    WHERE is_active = true
    ORDER BY created_at
    LIMIT 1;
    
    IF v_location_id IS NULL THEN
      RAISE EXCEPTION 'No active location found';
    END IF;
  ELSE
    v_location_id := p_location_id;
  END IF;

  -- Validate stock availability with row locking (prevents race conditions)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_required_qty := (v_item->>'quantity')::NUMERIC;
    
    SELECT quantity INTO v_current_stock
    FROM inventory
    WHERE location_id = v_location_id
      AND product_id = (v_item->>'product_id')::UUID
      AND (
        (variant_id = (v_item->>'variant_id')::UUID) OR 
        (variant_id IS NULL AND (v_item->>'variant_id') IS NULL)
      )
    FOR UPDATE;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory record not found for product: % at location: %', 
        v_item->>'product_name', v_location_id;
    END IF;
    
    IF v_current_stock < v_required_qty THEN
      RAISE EXCEPTION 'Insufficient stock for %: Available=%, Required=%', 
        v_item->>'product_name', v_current_stock, v_required_qty;
    END IF;
  END LOOP;

  v_sale_number := 'SALE-' || EXTRACT(EPOCH FROM NOW())::BIGINT;

  -- Insert sale record with proper type casting for status
  INSERT INTO sales (
    sale_number,
    location_id,
    customer_id,
    cashier_id,
    shift_id,
    status,
    subtotal,
    discount_amount,
    discount_percentage,
    tax_amount,
    total_amount,
    amount_paid,
    change_amount,
    notes,
    completed_at
  )
  VALUES (
    v_sale_number,
    v_location_id,
    (p_sale->>'customer_id')::UUID,
    (p_sale->>'cashier_id')::UUID,
    (p_sale->>'shift_id')::UUID,
    COALESCE((p_sale->>'status')::sale_status, 'completed'::sale_status),
    (p_sale->>'subtotal')::NUMERIC,
    (p_sale->>'discount_amount')::NUMERIC,
    (p_sale->>'discount_percentage')::NUMERIC,
    (p_sale->>'tax_amount')::NUMERIC,
    (p_sale->>'total_amount')::NUMERIC,
    (p_sale->>'amount_paid')::NUMERIC,
    (p_sale->>'change_amount')::NUMERIC,
    p_sale->>'notes',
    NOW()
  )
  RETURNING id INTO v_sale_id;

  -- Process each sale item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    DECLARE
      v_item_cost NUMERIC;
      v_item_profit NUMERIC;
    BEGIN
      v_item_cost := (v_item->>'cost_price')::NUMERIC * (v_item->>'quantity')::NUMERIC;
      v_item_profit := (v_item->>'line_total')::NUMERIC - v_item_cost;
      
      v_total_cost := v_total_cost + v_item_cost;
      v_total_profit := v_total_profit + v_item_profit;

      INSERT INTO sale_items (
        sale_id,
        product_id,
        variant_id,
        product_name,
        sku,
        quantity,
        unit_price,
        discount_amount,
        discount_percentage,
        tax_rate,
        tax_amount,
        line_total,
        cost_price,
        profit_amount
      )
      VALUES (
        v_sale_id,
        (v_item->>'product_id')::UUID,
        (v_item->>'variant_id')::UUID,
        v_item->>'product_name',
        v_item->>'sku',
        (v_item->>'quantity')::NUMERIC,
        (v_item->>'unit_price')::NUMERIC,
        (v_item->>'discount_amount')::NUMERIC,
        (v_item->>'discount_percentage')::NUMERIC,
        (v_item->>'tax_rate')::NUMERIC,
        (v_item->>'tax_amount')::NUMERIC,
        (v_item->>'line_total')::NUMERIC,
        (v_item->>'cost_price')::NUMERIC,
        v_item_profit
      );

      UPDATE inventory
      SET 
        quantity = quantity - (v_item->>'quantity')::NUMERIC,
        updated_at = NOW()
      WHERE location_id = v_location_id
        AND product_id = (v_item->>'product_id')::UUID
        AND (
          (variant_id = (v_item->>'variant_id')::UUID) OR 
          (variant_id IS NULL AND (v_item->>'variant_id') IS NULL)
        );

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Failed to update inventory for product: %', v_item->>'product_name';
      END IF;

      INSERT INTO stock_movements (
        product_id,
        variant_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        notes,
        created_by,
        created_at
      )
      VALUES (
        (v_item->>'product_id')::UUID,
        (v_item->>'variant_id')::UUID,
        'sale',
        -(v_item->>'quantity')::NUMERIC,
        'sale',
        v_sale_id,
        'Sale: ' || v_sale_number || ' - ' || (v_item->>'product_name'),
        (p_sale->>'cashier_id')::UUID,
        NOW()
      );
    END;
  END LOOP;

  UPDATE sales
  SET 
    total_cost = v_total_cost,
    total_profit = v_total_profit
  WHERE id = v_sale_id;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO payments (
      sale_id,
      payment_method_id,
      amount,
      reference_number,
      notes
    )
    VALUES (
      v_sale_id,
      (v_payment->>'payment_method_id')::UUID,
      (v_payment->>'amount')::NUMERIC,
      v_payment->>'reference_number',
      v_payment->>'notes'
    );
  END LOOP;

  SELECT jsonb_build_object(
    'id', s.id,
    'sale_number', s.sale_number,
    'total_amount', s.total_amount,
    'total_cost', s.total_cost,
    'total_profit', s.total_profit,
    'created_at', s.created_at
  )
  INTO v_result
  FROM sales s
  WHERE s.id = v_sale_id;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Sale transaction failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_sale(JSONB, JSONB, JSONB, UUID) TO authenticated;