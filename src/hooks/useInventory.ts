import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Inventory, StockAdjustment } from '../types/database';
import toast from 'react-hot-toast';

export function useInventory(locationId?: string) {
  return useQuery({
    queryKey: ['inventory', locationId],
    queryFn: async () => {
      let query = supabase
        .from('inventory')
        .select(`
          *,
          location:locations(*),
          product:products(*),
          variant:product_variants(*)
        `)
        .order('updated_at', { ascending: false });

      if (locationId) {
        query = query.eq('location_id', locationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useLowStockItems(locationId?: string) {
  return useQuery({
    queryKey: ['inventory', 'low-stock', locationId],
    queryFn: async () => {
      let query = supabase
        .from('inventory')
        .select(`
          *,
          location:locations(*),
          product:products(*),
          variant:product_variants(*)
        `)
        .lt('quantity', supabase.raw('low_stock_threshold'))
        .order('quantity', { ascending: true });

      if (locationId) {
        query = query.eq('location_id', locationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      locationId,
      productId,
      variantId,
      quantityChange,
      batchNumber
    }: {
      locationId: string;
      productId: string | null;
      variantId: string | null;
      quantityChange: number;
      batchNumber?: string | null;
    }) => {
      const { data: existing } = await supabase
        .from('inventory')
        .select('*')
        .eq('location_id', locationId)
        .eq('product_id', productId || '')
        .eq('variant_id', variantId || '')
        .eq('batch_number', batchNumber || '')
        .maybeSingle();

      if (existing) {
        const newQuantity = Number(existing.quantity) + quantityChange;
        const { data, error } = await supabase
          .from('inventory')
          .update({ quantity: newQuantity })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('inventory')
          .insert({
            location_id: locationId,
            product_id: productId,
            variant_id: variantId,
            quantity: Math.max(0, quantityChange),
            batch_number: batchNumber || null,
            low_stock_threshold: 10,
            expiry_date: null,
            last_counted_at: null,
            last_counted_by: null,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-valuation'] });
    },
  });
}

export function useStockAdjustment() {
  const queryClient = useQueryClient();
  const updateInventory = useUpdateInventory();

  return useMutation({
    mutationFn: async (adjustment: Omit<StockAdjustment, 'id' | 'created_at' | 'adjustment_number'>) => {
      const adjustmentNumber = `ADJ-${Date.now()}`;

      const { data, error } = await supabase
        .from('stock_adjustments')
        .insert({
          ...adjustment,
          adjustment_number: adjustmentNumber,
        })
        .select()
        .single();

      if (error) throw error;

      await updateInventory.mutateAsync({
        locationId: adjustment.location_id,
        productId: adjustment.product_id,
        variantId: adjustment.variant_id,
        quantityChange: adjustment.quantity_change,
        batchNumber: null,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-valuation'] });
      toast.success('Stock adjustment recorded');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to record stock adjustment');
    },
  });
}
