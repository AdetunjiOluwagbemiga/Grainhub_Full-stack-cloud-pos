/*
  # Fix Purchase Orders and Missing Inventory Records

  1. Purchase Order Fixes
    - Create PO number generation function with sequence
    - Add trigger to calculate PO total_amount from line items
    - Update total_amount on INSERT/UPDATE/DELETE of PO items

  2. Inventory Fixes
    - Initialize missing inventory records for 9 products
    - Ensure all active tracked products have inventory records
*/

-- Create sequence for PO numbers
CREATE SEQUENCE IF NOT EXISTS po_number_seq START 1000;

-- Create PO number generation function
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'PO-' || LPAD(nextval('po_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Create function to update PO total
CREATE OR REPLACE FUNCTION update_po_total()
RETURNS TRIGGER AS $$
DECLARE
  v_po_id UUID;
  v_total NUMERIC;
BEGIN
  -- Determine which PO to update
  IF TG_OP = 'DELETE' THEN
    v_po_id := OLD.po_id;
  ELSE
    v_po_id := NEW.po_id;
  END IF;

  -- Calculate total from all items
  SELECT COALESCE(SUM(quantity * COALESCE(unit_cost, cost_price)), 0)
  INTO v_total
  FROM purchase_order_items
  WHERE po_id = v_po_id;

  -- Update the purchase order
  UPDATE purchase_orders
  SET total_amount = v_total,
      updated_at = NOW()
  WHERE id = v_po_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_update_po_total ON purchase_order_items;

-- Create trigger for PO total calculation
CREATE TRIGGER trigger_update_po_total
  AFTER INSERT OR UPDATE OR DELETE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_total();

-- Fix missing inventory records
-- Insert inventory records for all active tracked products without inventory
INSERT INTO inventory (location_id, product_id, variant_id, quantity, low_stock_threshold)
SELECT 
  (SELECT id FROM locations WHERE is_default = true LIMIT 1),
  p.id,
  NULL,
  0,
  10
FROM products p
LEFT JOIN inventory i ON p.id = i.product_id
WHERE p.is_active = true 
  AND p.track_inventory = true
  AND i.id IS NULL
ON CONFLICT DO NOTHING;
