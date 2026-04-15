/*
  # Fix apply_stock_adjustment missing adjustment_number

  ## Problem
  The `apply_stock_adjustment` function inserts into `stock_adjustments` without
  providing a value for `adjustment_number`, which is NOT NULL with no default,
  causing "null value violates not-null constraint" errors when creating products
  with an initial stock quantity.

  ## Fix
  Update the function to generate an `adjustment_number` using a timestamp-based
  format (ADJ-<epoch_ms>) before inserting the stock adjustment record.
*/

CREATE OR REPLACE FUNCTION public.apply_stock_adjustment(
  p_location_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity_change numeric,
  p_reason text,
  p_notes text,
  p_adjusted_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_adjustment_id UUID;
  v_adjustment_number TEXT;
  v_old_quantity NUMERIC;
  v_new_quantity NUMERIC;
BEGIN
  -- Generate a unique adjustment number
  v_adjustment_number := 'ADJ-' || FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT::TEXT;

  -- Get current quantity (or 0 if record doesn't exist)
  SELECT COALESCE(quantity, 0) INTO v_old_quantity
  FROM inventory
  WHERE location_id = p_location_id
    AND product_id = p_product_id
    AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL));

  v_old_quantity := COALESCE(v_old_quantity, 0);
  v_new_quantity := v_old_quantity + p_quantity_change;

  -- UPSERT inventory record
  INSERT INTO inventory (
    location_id,
    product_id,
    variant_id,
    quantity,
    low_stock_threshold,
    updated_at
  )
  VALUES (
    p_location_id,
    p_product_id,
    p_variant_id,
    v_new_quantity,
    10,
    NOW()
  )
  ON CONFLICT (location_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET
    quantity = EXCLUDED.quantity,
    updated_at = NOW();

  -- Create stock adjustment record with generated number
  INSERT INTO stock_adjustments (
    adjustment_number,
    location_id,
    product_id,
    variant_id,
    quantity_change,
    reason,
    notes,
    adjusted_by
  )
  VALUES (
    v_adjustment_number,
    p_location_id,
    p_product_id,
    p_variant_id,
    p_quantity_change,
    p_reason,
    p_notes,
    p_adjusted_by
  )
  RETURNING id INTO v_adjustment_id;

  RETURN jsonb_build_object(
    'adjustment_id', v_adjustment_id,
    'old_quantity', v_old_quantity,
    'new_quantity', v_new_quantity,
    'quantity_change', p_quantity_change
  );
END;
$function$;
