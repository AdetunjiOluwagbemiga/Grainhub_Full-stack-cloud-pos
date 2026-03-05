/*
  # Auto-Initialize Inventory on Product Creation

  ## Overview
  This migration creates a trigger that automatically initializes inventory
  records for new products in the Main Store location with quantity 0.

  ## Changes
  1. Create trigger function to auto-create inventory record
  2. Attach trigger to products table on INSERT
  3. Update stock adjustment function to use UPSERT logic

  ## Business Logic
  - When a product is created, automatically create an inventory record
  - Set initial quantity to 0 for Main Store location
  - Uses UPSERT pattern to handle existing records gracefully
*/

-- Create function to get or create Main Store location
CREATE OR REPLACE FUNCTION get_main_store_location_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_location_id UUID;
BEGIN
  -- Try to find the Main Store location
  SELECT id INTO v_location_id
  FROM locations
  WHERE name = 'Main Store' OR is_active = true
  ORDER BY created_at
  LIMIT 1;
  
  -- If no location exists, return NULL (should not happen in production)
  IF v_location_id IS NULL THEN
    RAISE WARNING 'No active location found for inventory initialization';
  END IF;
  
  RETURN v_location_id;
END;
$$;

-- Create trigger function to auto-initialize inventory
CREATE OR REPLACE FUNCTION auto_initialize_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_location_id UUID;
BEGIN
  -- Only proceed if product tracks inventory
  IF NEW.track_inventory = true THEN
    -- Get the Main Store location
    v_location_id := get_main_store_location_id();
    
    IF v_location_id IS NOT NULL THEN
      -- Insert inventory record with quantity 0
      INSERT INTO inventory (
        location_id,
        product_id,
        variant_id,
        quantity,
        low_stock_threshold,
        created_at,
        updated_at
      )
      VALUES (
        v_location_id,
        NEW.id,
        NULL,
        0,
        10,
        NOW(),
        NOW()
      )
      ON CONFLICT (location_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
      DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_auto_initialize_inventory ON products;
CREATE TRIGGER trigger_auto_initialize_inventory
  AFTER INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION auto_initialize_inventory();

-- Update stock adjustment to use UPSERT logic
CREATE OR REPLACE FUNCTION apply_stock_adjustment(
  p_location_id UUID,
  p_product_id UUID,
  p_variant_id UUID,
  p_quantity_change NUMERIC,
  p_reason TEXT,
  p_notes TEXT,
  p_adjusted_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_adjustment_id UUID;
  v_old_quantity NUMERIC;
  v_new_quantity NUMERIC;
BEGIN
  -- Get current quantity (or 0 if record doesn't exist)
  SELECT COALESCE(quantity, 0) INTO v_old_quantity
  FROM inventory
  WHERE location_id = p_location_id
    AND product_id = p_product_id
    AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL));
  
  -- If no record found, default to 0
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
  
  -- Create stock adjustment record
  INSERT INTO stock_adjustments (
    location_id,
    product_id,
    variant_id,
    quantity_change,
    reason,
    notes,
    adjusted_by
  )
  VALUES (
    p_location_id,
    p_product_id,
    p_variant_id,
    p_quantity_change,
    p_reason,
    p_notes,
    p_adjusted_by
  )
  RETURNING id INTO v_adjustment_id;
  
  -- Return result
  RETURN jsonb_build_object(
    'adjustment_id', v_adjustment_id,
    'old_quantity', v_old_quantity,
    'new_quantity', v_new_quantity,
    'quantity_change', p_quantity_change
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_main_store_location_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_initialize_inventory() TO authenticated;
GRANT EXECUTE ON FUNCTION apply_stock_adjustment(UUID, UUID, UUID, NUMERIC, TEXT, TEXT, UUID) TO authenticated;