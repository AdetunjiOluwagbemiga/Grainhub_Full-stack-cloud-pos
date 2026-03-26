/*
  # Add Product Expiry Date Tracking

  1. Changes
    - Add `expiry_date` column to products table (for default expiry tracking)
    - Add `alert_days_before_expiry` for customizable alerts per product
    - Create view for expiring inventory items
    - Create functions to get expiring products and statistics
    - Note: Inventory table already has batch_number and expiry_date for specific batches

  2. Security
    - Maintain existing RLS policies
    - Views inherit security from base table

  3. Notes
    - Products can have a default expiry_date
    - Individual inventory batches can override with their own expiry_date
    - This allows tracking both product-level and batch-level expiration
*/

-- Add expiry tracking columns to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'expiry_date'
  ) THEN
    ALTER TABLE products ADD COLUMN expiry_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'alert_days_before_expiry'
  ) THEN
    ALTER TABLE products ADD COLUMN alert_days_before_expiry integer DEFAULT 7;
  END IF;
END $$;

-- Create index for faster expiry date queries
CREATE INDEX IF NOT EXISTS idx_products_expiry_date ON products(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_expiry_date ON inventory(expiry_date) WHERE expiry_date IS NOT NULL;

-- Create comprehensive view for expiring inventory
CREATE OR REPLACE VIEW expiring_inventory AS
SELECT 
  i.id as inventory_id,
  p.id as product_id,
  p.name as product_name,
  p.sku,
  p.barcode,
  COALESCE(i.expiry_date, p.expiry_date) as expiry_date,
  i.batch_number,
  i.quantity,
  p.retail_price,
  i.location_id,
  (COALESCE(i.expiry_date, p.expiry_date) - CURRENT_DATE) as days_until_expiry,
  CASE 
    WHEN COALESCE(i.expiry_date, p.expiry_date) < CURRENT_DATE THEN 'expired'
    WHEN COALESCE(i.expiry_date, p.expiry_date) <= CURRENT_DATE + INTERVAL '7 days' THEN 'critical'
    WHEN COALESCE(i.expiry_date, p.expiry_date) <= CURRENT_DATE + INTERVAL '30 days' THEN 'warning'
    ELSE 'normal'
  END as expiry_status,
  (i.quantity * p.retail_price) as total_value
FROM inventory i
INNER JOIN products p ON p.id = i.product_id
WHERE (i.expiry_date IS NOT NULL OR p.expiry_date IS NOT NULL)
  AND p.is_active = true
  AND i.quantity > 0
ORDER BY COALESCE(i.expiry_date, p.expiry_date) ASC;

-- Grant access to the view
GRANT SELECT ON expiring_inventory TO authenticated;

-- Create function to get products expiring within specified days
CREATE OR REPLACE FUNCTION get_products_expiring_within(days_ahead integer DEFAULT 30)
RETURNS TABLE (
  inventory_id uuid,
  product_id uuid,
  product_name text,
  sku text,
  barcode text,
  expiry_date date,
  batch_number text,
  days_until_expiry integer,
  quantity numeric,
  retail_price numeric,
  total_value numeric,
  expiry_status text,
  location_id uuid
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id as inventory_id,
    p.id as product_id,
    p.name as product_name,
    p.sku,
    p.barcode,
    COALESCE(i.expiry_date, p.expiry_date) as expiry_date,
    i.batch_number,
    (COALESCE(i.expiry_date, p.expiry_date) - CURRENT_DATE)::integer as days_until_expiry,
    i.quantity,
    p.retail_price,
    (i.quantity * p.retail_price) as total_value,
    CASE 
      WHEN COALESCE(i.expiry_date, p.expiry_date) < CURRENT_DATE THEN 'expired'
      WHEN COALESCE(i.expiry_date, p.expiry_date) <= CURRENT_DATE + days_ahead THEN 'expiring_soon'
      ELSE 'normal'
    END as expiry_status,
    i.location_id
  FROM inventory i
  INNER JOIN products p ON p.id = i.product_id
  WHERE (i.expiry_date IS NOT NULL OR p.expiry_date IS NOT NULL)
    AND COALESCE(i.expiry_date, p.expiry_date) <= CURRENT_DATE + days_ahead
    AND p.is_active = true
    AND i.quantity > 0
  ORDER BY COALESCE(i.expiry_date, p.expiry_date) ASC;
END;
$$;

-- Create function to get expiry statistics
CREATE OR REPLACE FUNCTION get_expiry_statistics()
RETURNS TABLE (
  expired_count bigint,
  expiring_7days bigint,
  expiring_30days bigint,
  expired_value numeric,
  expiring_value numeric
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE COALESCE(i.expiry_date, p.expiry_date) < CURRENT_DATE) as expired_count,
    COUNT(*) FILTER (WHERE COALESCE(i.expiry_date, p.expiry_date) >= CURRENT_DATE AND COALESCE(i.expiry_date, p.expiry_date) <= CURRENT_DATE + INTERVAL '7 days') as expiring_7days,
    COUNT(*) FILTER (WHERE COALESCE(i.expiry_date, p.expiry_date) >= CURRENT_DATE AND COALESCE(i.expiry_date, p.expiry_date) <= CURRENT_DATE + INTERVAL '30 days') as expiring_30days,
    COALESCE(SUM(CASE WHEN COALESCE(i.expiry_date, p.expiry_date) < CURRENT_DATE THEN i.quantity * p.retail_price ELSE 0 END), 0) as expired_value,
    COALESCE(SUM(CASE WHEN COALESCE(i.expiry_date, p.expiry_date) >= CURRENT_DATE AND COALESCE(i.expiry_date, p.expiry_date) <= CURRENT_DATE + INTERVAL '30 days' THEN i.quantity * p.retail_price ELSE 0 END), 0) as expiring_value
  FROM inventory i
  INNER JOIN products p ON p.id = i.product_id
  WHERE (i.expiry_date IS NOT NULL OR p.expiry_date IS NOT NULL)
    AND p.is_active = true
    AND i.quantity > 0;
END;
$$;