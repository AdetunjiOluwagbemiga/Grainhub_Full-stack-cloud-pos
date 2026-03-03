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
          cashier:user_profiles(*),
          sale_items(*)
        `)
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
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
          cashier:user_profiles(*),
          sale_items(*),
          payments(*, payment_method:payment_methods(*))
        `)
        .eq('id', saleId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!saleId,
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  const updateInventory = useUpdateInventory();

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
      locationId: string;
    }) => {
      const saleNumber = `SALE-${Date.now()}`;

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          ...sale,
          sale_number: saleNumber,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      const saleItems = items.map(item => ({
        sale_id: saleData.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.product_name,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        discount_percentage: item.discount_percentage,
        tax_rate: item.tax_rate,
        tax_amount: item.tax_amount,
        line_total: item.line_total,
        cost_price: item.cost_price,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      const paymentRecords = payments.map(payment => ({
        ...payment,
        sale_id: saleData.id,
      }));

      const { error: paymentsError } = await supabase
        .from('payments')
        .insert(paymentRecords);

      if (paymentsError) throw paymentsError;

      for (const item of items) {
        await updateInventory.mutateAsync({
          locationId,
          productId: item.product_id,
          variantId: item.variant_id,
          quantityChange: -item.quantity,
          batchNumber: null,
        });
      }

      return saleData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['valuation'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
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
