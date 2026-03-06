/*
  # Add variant_id to stock_movements table

  ## Overview
  Adds variant_id column to stock_movements table to properly track inventory
  movements for product variants.

  ## Changes
  1. Add variant_id column to stock_movements table
  2. Add foreign key constraint to product_variants table

  ## Technical Details
  - Column is nullable since not all products have variants
  - Foreign key ensures referential integrity
*/

-- Add variant_id column to stock_movements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_movements' AND column_name = 'variant_id'
  ) THEN
    ALTER TABLE stock_movements ADD COLUMN variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;
  END IF;
END $$;