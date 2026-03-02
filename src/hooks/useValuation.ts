import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface InventoryValuation {
  product_id: string;
  sku: string;
  product_name: string;
  cost_price: number;
  retail_price: number;
  category_name: string | null;
  category_id: string | null;
  stock_quantity: number;
  total_cost_value: number;
  total_retail_value: number;
  potential_profit: number;
  margin_percentage: number;
  needs_costing: boolean;
  has_negative_stock: boolean;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ValuationSummary {
  total_products: number;
  total_stock: number;
  total_cost_value: number;
  total_retail_value: number;
  total_potential_profit: number;
  average_margin_percentage: number;
  products_needing_costing: number;
  products_with_negative_stock: number;
  low_margin_products: number;
}

export interface CategoryValuation {
  category_id: string | null;
  category_name: string;
  product_count: number;
  total_stock: number;
  total_cost_value: number;
  total_retail_value: number;
  potential_profit: number;
  average_margin: number;
}

export function useInventoryValuation() {
  return useQuery({
    queryKey: ['inventory_valuation'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_valuation')
        .select('*')
        .order('total_cost_value', { ascending: false });

      if (error) throw error;
      return data as InventoryValuation[];
    },
  });
}

export function useValuationSummary(categoryId?: string | null, excludeNegative: boolean = true) {
  return useQuery({
    queryKey: ['valuation_summary', categoryId, excludeNegative],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_valuation_summary', {
        p_category_id: categoryId || null,
        p_exclude_negative: excludeNegative,
      });

      if (error) throw error;
      return data?.[0] as ValuationSummary;
    },
  });
}

export function useCategoryValuationBreakdown() {
  return useQuery({
    queryKey: ['category_valuation_breakdown'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_category_valuation_breakdown');

      if (error) throw error;
      return data as CategoryValuation[];
    },
  });
}
