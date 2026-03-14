/*
  # Fix Existing Sale Items Profit Amounts

  1. Updates
    - Calculate and update profit_amount for existing sale items
    - Only updates items where profit_amount is 0 or NULL
    - Uses formula: (quantity * (unit_price - cost_price))
*/

-- Update existing sale items with correct profit amounts
UPDATE sale_items
SET profit_amount = quantity * (unit_price - COALESCE(cost_price, 0))
WHERE profit_amount = 0 OR profit_amount IS NULL;

-- Add generated column constraint for future items (optional but recommended)
-- This ensures profit is always calculated correctly
COMMENT ON COLUMN sale_items.profit_amount IS 'Calculated as: quantity * (unit_price - cost_price)';
