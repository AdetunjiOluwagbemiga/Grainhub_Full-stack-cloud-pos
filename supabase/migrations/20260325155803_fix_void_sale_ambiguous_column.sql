/*
  # Fix void_sale function - resolve ambiguous column reference

  1. Changes
    - Update `void_sale()` function to properly qualify column references
    - Use table aliases to avoid ambiguity between inventory.quantity and sale_items.quantity

  2. Security
    - Maintains existing RLS and permissions
*/

CREATE OR REPLACE FUNCTION void_sale(p_sale_id UUID, p_reason TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_sale_record JSONB;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get sale record for audit
  SELECT jsonb_build_object(
    'id', id,
    'sale_number', sale_number,
    'total_amount', total_amount,
    'status', status,
    'is_voided', is_voided
  ) INTO v_sale_record
  FROM sales
  WHERE id = p_sale_id;
  
  IF v_sale_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sale not found');
  END IF;
  
  -- Check if already voided
  IF (v_sale_record->>'is_voided')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sale is already voided');
  END IF;
  
  -- Void the sale
  UPDATE sales
  SET 
    is_voided = true,
    voided_at = now(),
    voided_by = v_user_id,
    void_reason = p_reason
  WHERE id = p_sale_id;
  
  -- Reverse inventory for voided sale (return stock back)
  UPDATE inventory i
  SET quantity = i.quantity + si.quantity
  FROM sale_items si
  WHERE i.product_id = si.product_id
    AND (i.variant_id = si.variant_id OR (i.variant_id IS NULL AND si.variant_id IS NULL))
    AND si.sale_id = p_sale_id;
  
  -- Log the void action
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    v_user_id,
    'VOID_SALE',
    'sales',
    p_sale_id,
    v_sale_record,
    jsonb_build_object('is_voided', true, 'void_reason', p_reason)
  );
  
  RETURN jsonb_build_object('success', true, 'message', 'Sale voided successfully');
END;
$$;