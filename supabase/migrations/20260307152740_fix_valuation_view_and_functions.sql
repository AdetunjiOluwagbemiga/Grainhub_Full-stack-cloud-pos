/*
  # Fix Inventory Valuation View and Functions

  ## Overview
  Re-creates the inventory valuation view and supporting RPC functions that were missing.

  ## New Views

  ### `inventory_valuation` View
  Provides comprehensive valuation metrics for each product:
  - Product details (id, name, sku, category)
  - Stock quantity and status
  - Cost and retail pricing
  - Calculated valuations:
    - Total cost value (stock × cost price)
    - Total retail value (stock × retail price)
    - Potential profit (retail value - cost value)
    - Potential margin percentage
  - Flags for data quality (missing cost, negative stock)

  ## RPC Functions

  ### `get_valuation_summary`
  Returns aggregated summary metrics:
  - Total products, stock units
  - Total cost value (sum of Asset Value column)
  - Total retail value (sum of Retail Value column)
  - Total potential profit
  - Average margin percentage
  - Products needing costing
  - Products with negative stock
  - Low margin products count

  ### `get_category_valuation_breakdown`
  Returns valuation metrics grouped by category

  ## Security
  - View inherits RLS policies from underlying tables
  - Authenticated users can view valuation data and execute functions
*/

-- Drop existing view and functions if they exist
DROP VIEW IF EXISTS inventory_valuation CASCADE;
DROP FUNCTION IF EXISTS get_valuation_summary CASCADE;
DROP FUNCTION IF EXISTS get_category_valuation_breakdown CASCADE;

-- Create inventory valuation view
CREATE OR REPLACE VIEW inventory_valuation AS
SELECT
  p.id AS product_id,
  p.sku,
  p.name AS product_name,
  p.cost_price,
  p.retail_price,
  c.name AS category_name,
  c.id AS category_id,
  COALESCE(i.quantity, 0) AS stock_quantity,
  
  -- Cost Value Calculation
  COALESCE(i.quantity, 0) * p.cost_price AS total_cost_value,
  
  -- Retail Value Calculation
  COALESCE(i.quantity, 0) * p.retail_price AS total_retail_value,
  
  -- Potential Profit Calculation
  (COALESCE(i.quantity, 0) * p.retail_price) - (COALESCE(i.quantity, 0) * p.cost_price) AS potential_profit,
  
  -- Margin Percentage Calculation
  CASE
    WHEN p.retail_price > 0 THEN
      (((p.retail_price - p.cost_price) / p.retail_price) * 100)
    ELSE 0
  END AS margin_percentage,
  
  -- Data Quality Flags
  CASE
    WHEN p.cost_price IS NULL OR p.cost_price = 0 THEN true
    ELSE false
  END AS needs_costing,
  
  CASE
    WHEN COALESCE(i.quantity, 0) < 0 THEN true
    ELSE false
  END AS has_negative_stock,
  
  -- Status flags
  CASE
    WHEN COALESCE(i.quantity, 0) <= 0 THEN 'out_of_stock'
    WHEN COALESCE(i.quantity, 0) <= i.low_stock_threshold THEN 'low_stock'
    ELSE 'in_stock'
  END AS stock_status,
  
  p.is_active,
  p.created_at,
  p.updated_at

FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN (
  SELECT 
    product_id,
    SUM(quantity) AS quantity,
    MAX(low_stock_threshold) AS low_stock_threshold
  FROM inventory
  GROUP BY product_id
) i ON p.id = i.product_id

WHERE p.is_active = true;

-- Create function to get valuation summary
CREATE OR REPLACE FUNCTION get_valuation_summary(
  p_category_id uuid DEFAULT NULL,
  p_exclude_negative boolean DEFAULT true
)
RETURNS TABLE (
  total_products bigint,
  total_stock numeric,
  total_cost_value numeric,
  total_retail_value numeric,
  total_potential_profit numeric,
  average_margin_percentage numeric,
  products_needing_costing bigint,
  products_with_negative_stock bigint,
  low_margin_products bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_products,
    COALESCE(SUM(stock_quantity), 0) AS total_stock,
    COALESCE(SUM(
      CASE 
        WHEN p_exclude_negative AND has_negative_stock THEN 0
        ELSE total_cost_value
      END
    ), 0) AS total_cost_value,
    COALESCE(SUM(
      CASE 
        WHEN p_exclude_negative AND has_negative_stock THEN 0
        ELSE total_retail_value
      END
    ), 0) AS total_retail_value,
    COALESCE(SUM(
      CASE 
        WHEN p_exclude_negative AND has_negative_stock THEN 0
        ELSE potential_profit
      END
    ), 0) AS total_potential_profit,
    COALESCE(AVG(
      CASE 
        WHEN NOT has_negative_stock AND NOT needs_costing THEN margin_percentage
        ELSE NULL
      END
    ), 0) AS average_margin_percentage,
    COUNT(*) FILTER (WHERE needs_costing)::bigint AS products_needing_costing,
    COUNT(*) FILTER (WHERE has_negative_stock)::bigint AS products_with_negative_stock,
    COUNT(*) FILTER (WHERE margin_percentage < 10 AND NOT needs_costing)::bigint AS low_margin_products
  FROM inventory_valuation
  WHERE (p_category_id IS NULL OR category_id = p_category_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get category valuation breakdown
CREATE OR REPLACE FUNCTION get_category_valuation_breakdown()
RETURNS TABLE (
  category_id uuid,
  category_name text,
  product_count bigint,
  total_stock numeric,
  total_cost_value numeric,
  total_retail_value numeric,
  potential_profit numeric,
  average_margin numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    iv.category_id,
    COALESCE(iv.category_name, 'Uncategorized') AS category_name,
    COUNT(*)::bigint AS product_count,
    COALESCE(SUM(iv.stock_quantity), 0) AS total_stock,
    COALESCE(SUM(iv.total_cost_value), 0) AS total_cost_value,
    COALESCE(SUM(iv.total_retail_value), 0) AS total_retail_value,
    COALESCE(SUM(iv.potential_profit), 0) AS potential_profit,
    COALESCE(AVG(iv.margin_percentage), 0) AS average_margin
  FROM inventory_valuation iv
  WHERE NOT iv.has_negative_stock
  GROUP BY iv.category_id, iv.category_name
  ORDER BY total_cost_value DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON inventory_valuation TO authenticated;
GRANT EXECUTE ON FUNCTION get_valuation_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_category_valuation_breakdown TO authenticated;