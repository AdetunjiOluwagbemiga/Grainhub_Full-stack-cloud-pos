/*
  # Fix Valuation Summary Function Column Conflicts

  ## Changes
  - Fixed ambiguous column references in get_valuation_summary function
  - Used table aliases to qualify column names properly
  - Ensures the function returns correct aggregated values from inventory_valuation view
*/

-- Recreate function with fixed column references
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
    COALESCE(SUM(iv.stock_quantity), 0) AS total_stock,
    COALESCE(SUM(
      CASE 
        WHEN p_exclude_negative AND iv.has_negative_stock THEN 0
        ELSE iv.total_cost_value
      END
    ), 0) AS total_cost_value,
    COALESCE(SUM(
      CASE 
        WHEN p_exclude_negative AND iv.has_negative_stock THEN 0
        ELSE iv.total_retail_value
      END
    ), 0) AS total_retail_value,
    COALESCE(SUM(
      CASE 
        WHEN p_exclude_negative AND iv.has_negative_stock THEN 0
        ELSE iv.potential_profit
      END
    ), 0) AS total_potential_profit,
    COALESCE(AVG(
      CASE 
        WHEN NOT iv.has_negative_stock AND NOT iv.needs_costing THEN iv.margin_percentage
        ELSE NULL
      END
    ), 0) AS average_margin_percentage,
    COUNT(*) FILTER (WHERE iv.needs_costing)::bigint AS products_needing_costing,
    COUNT(*) FILTER (WHERE iv.has_negative_stock)::bigint AS products_with_negative_stock,
    COUNT(*) FILTER (WHERE iv.margin_percentage < 10 AND NOT iv.needs_costing)::bigint AS low_margin_products
  FROM inventory_valuation iv
  WHERE (p_category_id IS NULL OR iv.category_id = p_category_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_valuation_summary TO authenticated;