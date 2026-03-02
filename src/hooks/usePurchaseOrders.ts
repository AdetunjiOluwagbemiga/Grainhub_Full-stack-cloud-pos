import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_contact: string | null;
  location_id: string;
  status: string;
  total_amount: number;
  notes: string | null;
  ordered_by: string | null;
  received_by: string | null;
  ordered_at: string | null;
  received_at: string | null;
  expected_delivery: string | null;
  created_at: string;
  updated_at: string;
}

export interface POItem {
  id: string;
  po_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  quantity_received: number;
  cost_price: number;
  unit_cost: number;
  batch_number: string | null;
  expiry_date: string | null;
  created_at: string;
}

export interface POWithItems extends PurchaseOrder {
  purchase_order_items: (POItem & {
    products: {
      id: string;
      name: string;
      sku: string;
    };
  })[];
}

export interface CreatePOData {
  supplier_id: string;
  expected_delivery?: string;
  notes?: string;
  items: {
    product_id: string;
    quantity: number;
    unit_cost: number;
  }[];
}

export function usePurchaseOrders() {
  return useQuery({
    queryKey: ['purchase_orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          suppliers (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (PurchaseOrder & { suppliers: { id: string; name: string } | null })[];
    },
  });
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['purchase_orders', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          suppliers (
            id,
            name,
            contact_person,
            phone,
            email
          ),
          purchase_order_items (
            *,
            products (
              id,
              name,
              sku
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as POWithItems;
    },
    enabled: !!id,
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (poData: CreatePOData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const defaultLocationId = 'eb23cc18-3aa6-4a73-9115-ed493974c5fa';

      const { data: poNumber } = await supabase.rpc('generate_po_number');

      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: poNumber || `PO-${Date.now()}`,
          supplier_id: poData.supplier_id,
          location_id: defaultLocationId,
          status: 'draft',
          ordered_by: user.id,
          expected_delivery: poData.expected_delivery || null,
          notes: poData.notes || null,
        })
        .select()
        .single();

      if (poError) throw poError;

      const items = poData.items.map(item => ({
        po_id: po.id,
        product_id: item.product_id,
        quantity: item.quantity,
        cost_price: item.unit_cost,
        unit_cost: item.unit_cost,
        quantity_received: 0,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(items);

      if (itemsError) throw itemsError;

      return po;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      toast.success('Purchase order created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create purchase order');
    },
  });
}

export function useUpdatePOStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updateData: any = { status };

      if (status === 'sent' && !updateData.ordered_at) {
        updateData.ordered_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('purchase_orders')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      toast.success('Purchase order status updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update purchase order');
    },
  });
}

export function useReceivePOItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, quantityReceived }: { itemId: string; quantityReceived: number }) => {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .update({ quantity_received: quantityReceived })
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to receive item');
    },
  });
}

export function useLowStockProducts() {
  return useQuery({
    queryKey: ['products', 'low-stock'],
    queryFn: async () => {
      const defaultLocationId = 'eb23cc18-3aa6-4a73-9115-ed493974c5fa';

      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          products (
            id,
            name,
            sku,
            cost_price
          )
        `)
        .eq('location_id', defaultLocationId)
        .filter('quantity', 'lte', 'low_stock_threshold');

      if (error) throw error;
      return data;
    },
  });
}
