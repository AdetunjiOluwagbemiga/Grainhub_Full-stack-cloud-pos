/*
  # Add Grocery Store POS Enhancements - Final

  ## Overview
  This migration adds comprehensive grocery store features including profit tracking, 
  categories, barcodes, and weight-based products.

  ## Enhancements
  
  1. **Product Enhancements**
    - Add `barcode` column for scanning
    - Add `is_weighed` for weight-based products
    - Add `margin_percent` for profit tracking
    - Add `is_quick_sale` for frequently sold items

  2. **Sales Analytics**
    - Add cost tracking to sale_items
    - Calculate profit per item and per sale
    - Track total cost and profit per sale

  3. **Categories**
    - Add sort_order to categories table
    - Insert default grocery categories

  ## Security
    - All tables already have RLS enabled
*/

-- Add sort_order to categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE categories ADD COLUMN sort_order integer DEFAULT 0;
  END IF;
END $$;

-- Add missing columns to products if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'barcode'
  ) THEN
    ALTER TABLE products ADD COLUMN barcode text;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_unique ON products(barcode) WHERE barcode IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'is_weighed'
  ) THEN
    ALTER TABLE products ADD COLUMN is_weighed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'margin_percent'
  ) THEN
    ALTER TABLE products ADD COLUMN margin_percent numeric(5,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'is_quick_sale'
  ) THEN
    ALTER TABLE products ADD COLUMN is_quick_sale boolean DEFAULT false;
  END IF;
END $$;

-- Add cost_price to sale_items for profit tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_items' AND column_name = 'cost_price'
  ) THEN
    ALTER TABLE sale_items ADD COLUMN cost_price numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_items' AND column_name = 'profit_amount'
  ) THEN
    ALTER TABLE sale_items ADD COLUMN profit_amount numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Add profit tracking to sales table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'total_cost'
  ) THEN
    ALTER TABLE sales ADD COLUMN total_cost numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'total_profit'
  ) THEN
    ALTER TABLE sales ADD COLUMN total_profit numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Insert default grocery categories if they don't exist
INSERT INTO categories (name, description, sort_order)
SELECT * FROM (VALUES
  ('Fruits & Vegetables', 'Fresh produce', 1),
  ('Dairy & Eggs', 'Dairy products and eggs', 2),
  ('Meat & Seafood', 'Fresh and frozen meat, poultry, and seafood', 3),
  ('Bakery', 'Bread, pastries, and baked goods', 4),
  ('Canned & Jarred', 'Canned and jarred foods', 5),
  ('Beverages', 'Soft drinks, juices, water', 6),
  ('Snacks', 'Chips, cookies, candy', 7),
  ('Frozen Foods', 'Frozen meals, ice cream, frozen vegetables', 8),
  ('Household', 'Cleaning supplies, paper products', 9),
  ('Personal Care', 'Health and beauty products', 10)
) AS v(name, description, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE categories.name = v.name
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_quick_sale ON products(is_quick_sale) WHERE is_quick_sale = true;
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order) WHERE is_active = true;