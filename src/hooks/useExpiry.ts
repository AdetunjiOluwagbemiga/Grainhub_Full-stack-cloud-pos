import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useExpiringProducts(daysAhead: number = 30) {
  return useQuery({
    queryKey: ['expiring-products', daysAhead],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_products_expiring_within', {
        days_ahead: daysAhead,
      });

      if (error) throw error;
      return data;
    },
  });
}

export function useExpiryStatistics() {
  return useQuery({
    queryKey: ['expiry-statistics'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_expiry_statistics');

      if (error) throw error;
      return data?.[0] || null;
    },
  });
}

export function useExpiringInventoryView() {
  return useQuery({
    queryKey: ['expiring-inventory-view'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expiring_inventory')
        .select('*')
        .order('expiry_date', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}
