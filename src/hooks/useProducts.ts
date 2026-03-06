import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Product, ProductWithInventory, Barcode } from '../types/database';
import toast from 'react-hot-toast';

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          barcodes(*),
          inventory(quantity)
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const productsWithStock = (data || []).map((product: any) => ({
        ...product,
        current_stock: product.inventory?.reduce((sum: number, inv: any) => sum + (inv.quantity || 0), 0) || 0,
      }));

      return productsWithStock as ProductWithInventory[];
    },
  });
}

export function useProductByBarcode(barcode: string | null) {
  return useQuery({
    queryKey: ['product', 'barcode', barcode],
    queryFn: async () => {
      if (!barcode) return null;

      const { data: barcodeData, error: barcodeError } = await supabase
        .from('barcodes')
        .select('*, products(*), product_variants(*)')
        .eq('barcode', barcode)
        .maybeSingle();

      if (barcodeError) throw barcodeError;
      if (!barcodeData) return null;

      if (barcodeData.product_id) {
        const { data, error } = await supabase
          .from('products')
          .select('*, category:categories(*), inventory(*)')
          .eq('id', barcodeData.product_id)
          .maybeSingle();

        if (error) throw error;
        return data;
      }

      if (barcodeData.variant_id && barcodeData.product_variants) {
        return {
          ...barcodeData.product_variants,
          isVariant: true,
        };
      }

      return null;
    },
    enabled: !!barcode,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'margin_percentage'>) => {
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create product');
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Product> }) => {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update product');
    },
  });
}

export function useAddBarcode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (barcode: Omit<Barcode, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('barcodes')
        .insert(barcode)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Barcode added successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add barcode');
    },
  });
}

export function useGenerateBarcode() {
  return useMutation({
    mutationFn: async (productId: string) => {
      const barcode = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const { data, error } = await supabase
        .from('barcodes')
        .insert({
          barcode,
          product_id: productId,
          variant_id: null,
          is_primary: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Barcode generated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate barcode');
    },
  });
}

export function useDeleteProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productIds: string[]) => {
      const { data, error } = await supabase
        .from('products')
        .update({ is_active: false })
        .in('id', productIds)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, productIds) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      const count = productIds.length;
      toast.success(`${count} product${count > 1 ? 's' : ''} deleted successfully`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete products');
    },
  });
}
