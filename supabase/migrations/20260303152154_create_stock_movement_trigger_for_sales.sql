/*
  # Add Automatic Stock Movement Tracking for Sales

  ## Overview
  This migration creates a database trigger to automatically record stock movements
  in the `stock_movements` table whenever a sale is completed. This provides a
  complete audit trail of all inventory changes due to sales transactions.

  ## Changes

  ### New Function: `create_stock_movements_for_sale()`
  Automatically creates stock movement records for each item in a sale:
  - Triggers when a new sale is created with status 'completed'
  - Records movement_type as 'sale' for each sale item
  - Links to the sale via reference_type and reference_id
  - Uses negative quantity to indicate stock deduction
  - Captures the cashier as the creator

  ### New Trigger: `trigger_create_stock_movements_for_sale`
  Executes after INSERT on the sales table when status is 'completed'

  ## Benefits
  1. **Automatic Audit Trail**: Every sale automatically creates stock movement records
  2. **Data Integrity**: Stock movements are guaranteed to match sales
  3. **Profit Tracking**: Sale items already include cost_price for margin calculation
  4. **Analytics Ready**: Stock movement data feeds into valuation and reporting views

  ## Security
  - No additional RLS policies needed (uses existing stock_movements policies)
  - Trigger runs with database privileges, ensuring reliable execution
*/

-- Function: Create stock movements for completed sales
CREATE OR REPLACE FUNCTION create_stock_movements_for_sale()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create stock movements for completed sales
  IF NEW.status = 'completed' THEN
    -- Insert stock movements for each sale item
    INSERT INTO stock_movements (
      product_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      notes,
      created_by,
      created_at
    )
    SELECT
      si.product_id,
      'sale',
      -si.quantity,  -- Negative to indicate stock reduction
      'sale',
      NEW.id,
      'Sale: ' || NEW.sale_number || ' - ' || si.product_name,
      NEW.cashier_id,
      NEW.created_at
    FROM sale_items si
    WHERE si.sale_id = NEW.id
      AND si.product_id IS NOT NULL;  -- Only create movements for products that exist
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Create stock movements after sale completion
DROP TRIGGER IF EXISTS trigger_create_stock_movements_for_sale ON sales;
CREATE TRIGGER trigger_create_stock_movements_for_sale
  AFTER INSERT ON sales
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION create_stock_movements_for_sale();

-- Function: Create stock movements when existing sale is voided
CREATE OR REPLACE FUNCTION create_stock_movements_for_voided_sale()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create reverse stock movements when a sale is voided
  IF NEW.status = 'voided' AND OLD.status != 'voided' THEN
    -- Insert reverse stock movements for each sale item
    INSERT INTO stock_movements (
      product_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      notes,
      created_by,
      created_at
    )
    SELECT
      si.product_id,
      'return',
      si.quantity,  -- Positive to indicate stock return
      'sale',
      NEW.id,
      'Voided Sale: ' || NEW.sale_number || ' - ' || NEW.void_reason,
      NEW.voided_by,
      now()
    FROM sale_items si
    WHERE si.sale_id = NEW.id
      AND si.product_id IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Create stock movements when sale is voided
DROP TRIGGER IF EXISTS trigger_create_stock_movements_for_voided_sale ON sales;
CREATE TRIGGER trigger_create_stock_movements_for_voided_sale
  AFTER UPDATE ON sales
  FOR EACH ROW
  WHEN (NEW.status = 'voided' AND OLD.status != 'voided')
  EXECUTE FUNCTION create_stock_movements_for_voided_sale();