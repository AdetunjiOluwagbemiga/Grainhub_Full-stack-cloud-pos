import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Sale, SaleItem, Payment, CartItem } from '../types/database';
import { useUpdateInventory } from './useInventory';
import toast from 'react-hot-toast';

export function useSales(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['sales', startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select(`
          *,
          customer:customers(*),
          cashier:user_profiles!sales_cashier_id_fkey(*),
          sale_items(*)
        `)
        .order('created_at', { ascending: false });

      if (startDate) {
        const formattedStart = typeof startDate === 'string' && startDate.includes('T')
          ? startDate
          : `${startDate}T00:00:00.000Z`;
        query = query.gte('created_at', formattedStart);
      }
      if (endDate) {
        const formattedEnd = typeof endDate === 'string' && endDate.includes('T')
          ? endDate
          : `${endDate}T23:59:59.999Z`;
        query = query.lte('created_at', formattedEnd);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Sales query error:', error);
        throw error;
      }
      return data || [];
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useSaleById(saleId: string | null) {
  return useQuery({
    queryKey: ['sale', saleId],
    queryFn: async () => {
      if (!saleId) return null;

      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers(*),
          cashier:user_profiles!sales_cashier_id_fkey(*),
          sale_items(*),
          payments(*, payment_method:payment_methods(*))
        `)
        .eq('id', saleId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching sale:', error);
        throw error;
      }

      console.log('Fetched sale data:', data);
      return data;
    },
    enabled: !!saleId,
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sale,
      items,
      payments,
      locationId,
    }: {
      sale: Omit<Sale, 'id' | 'created_at' | 'updated_at' | 'sale_number'>;
      items: CartItem[];
      payments: Omit<Payment, 'id' | 'created_at' | 'sale_id'>[];
      locationId: string | null;
    }) => {
      const { data, error } = await supabase.rpc('complete_sale', {
        p_sale: sale,
        p_items: items,
        p_payments: payments,
        p_location_id: locationId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['valuation'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      toast.success('Sale completed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to complete sale');
    },
  });
}

export function useVoidSale() {
  const queryClient = useQueryClient();
  const updateInventory = useUpdateInventory();

  return useMutation({
    mutationFn: async ({
      saleId,
      voidedBy,
      voidReason,
      locationId,
    }: {
      saleId: string;
      voidedBy: string;
      voidReason: string;
      locationId: string;
    }) => {
      const { data: sale } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('id', saleId)
        .single();

      if (!sale) throw new Error('Sale not found');

      const { data, error } = await supabase
        .from('sales')
        .update({
          status: 'voided',
          voided_by: voidedBy,
          voided_at: new Date().toISOString(),
          void_reason: voidReason,
        })
        .eq('id', saleId)
        .select()
        .single();

      if (error) throw error;

      for (const item of sale.sale_items) {
        await updateInventory.mutateAsync({
          locationId,
          productId: item.product_id,
          variantId: item.variant_id,
          quantityChange: item.quantity,
          batchNumber: null,
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Sale voided successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to void sale');
    },
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
  });
}

export function useDeleteSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (saleId: string) => {
      const { data, error } = await supabase.rpc('delete_sale', {
        p_sale_id: saleId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['valuation'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Sale deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete sale');
    },
  });
}

export function useTaxRules() {
  return useQuery({
    queryKey: ['tax-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_rules')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
  });
}
