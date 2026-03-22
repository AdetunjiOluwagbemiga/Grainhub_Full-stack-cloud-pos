/*
  # Fix Reset Data Function - Correct Inventory Column Name

  ## Changes
    - Fix `reset_all_data()` function to use correct column name `quantity` instead of `current_stock`
    - Fix `delete_sale_transaction()` function to use correct column name `quantity` instead of `current_stock`

  ## Details
    - The inventory table has a column named `quantity`, not `current_stock`
    - Both functions were trying to update a non-existent column
    - This migration corrects the column references in both functions

  ## Security
    - Functions remain admin-only
    - No changes to security or permissions
*/

-- Drop and recreate reset_all_data function with correct column name
DROP FUNCTION IF EXISTS reset_all_data();

CREATE OR REPLACE FUNCTION reset_all_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if user is admin
  SELECT role = 'admin' INTO v_is_admin
  FROM user_profiles
  WHERE id = v_user_id;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can reset data');
  END IF;
  
  -- Log the reset action
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data)
  VALUES (v_user_id, 'RESET_ALL_DATA', 'system', NULL, jsonb_build_object('timestamp', now()));
  
  -- Delete data in correct order (respecting foreign keys) with WHERE clauses
  DELETE FROM sale_items WHERE id IS NOT NULL;
  DELETE FROM sales WHERE id IS NOT NULL;
  DELETE FROM stock_movements WHERE id IS NOT NULL;
  DELETE FROM purchase_order_items WHERE id IS NOT NULL;
  DELETE FROM purchase_orders WHERE id IS NOT NULL;
  DELETE FROM shifts WHERE id IS NOT NULL;
  
  -- Reset inventory quantities to 0 (using correct column name: quantity)
  UPDATE inventory SET quantity = 0 WHERE id IS NOT NULL;
  
  -- Keep: products, product_variants, categories, customers, suppliers, locations, user_profiles, settings
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'All transactional data has been reset',
    'details', jsonb_build_object(
      'deleted', array['sales', 'sale_items', 'stock_movements', 'purchase_orders', 'shifts'],
      'reset', array['inventory quantities']
    )
  );
END;
$$;

-- Drop and recreate delete_sale_transaction function with correct column name
DROP FUNCTION IF EXISTS delete_sale_transaction(uuid);

CREATE OR REPLACE FUNCTION delete_sale_transaction(
  p_sale_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_sale_record jsonb;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if user is admin
  SELECT role = 'admin' INTO v_is_admin
  FROM user_profiles
  WHERE id = v_user_id;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can delete transactions');
  END IF;
  
  -- Get sale data before deletion
  SELECT jsonb_build_object(
    'id', s.id,
    'total_amount', s.total_amount,
    'status', s.status,
    'payment_method', s.payment_method,
    'created_at', s.created_at,
    'customer_id', s.customer_id,
    'items', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'product_id', si.product_id,
          'variant_id', si.variant_id,
          'quantity', si.quantity,
          'unit_price', si.unit_price
        )
      )
      FROM sale_items si
      WHERE si.sale_id = s.id
    )
  ) INTO v_sale_record
  FROM sales s
  WHERE s.id = p_sale_id;
  
  IF v_sale_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sale not found');
  END IF;
  
  -- Restore inventory for all items in this sale (using correct column name: quantity)
  UPDATE inventory
  SET quantity = quantity + si.quantity
  FROM sale_items si
  WHERE inventory.product_id = si.product_id
    AND (inventory.variant_id = si.variant_id OR (inventory.variant_id IS NULL AND si.variant_id IS NULL))
    AND si.sale_id = p_sale_id;
  
  -- Delete related stock movements
  DELETE FROM stock_movements
  WHERE reference_type = 'sale'
    AND reference_id = p_sale_id;
  
  -- Delete sale items
  DELETE FROM sale_items WHERE sale_id = p_sale_id;
  
  -- Delete the sale
  DELETE FROM sales WHERE id = p_sale_id;
  
  -- Log the deletion action
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    v_user_id,
    'DELETE_SALE',
    'sales',
    p_sale_id,
    v_sale_record,
    jsonb_build_object('deleted_at', now(), 'deleted_by', v_user_id)
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Sale transaction deleted successfully',
    'sale_id', p_sale_id
  );
END;
$$;
