import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export interface Shift {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  opening_float: number;
  expected_cash: number;
  actual_cash: number | null;
  variance: number | null;
  total_sales: number;
  total_cash_sales: number;
  total_card_sales: number;
  total_discounts: number;
  total_tax: number;
  transaction_count: number;
  status: 'open' | 'closed';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpenShiftData {
  opening_float: number;
}

export interface CloseShiftData {
  actual_cash: number;
  notes?: string;
}

export function useActiveShift() {
  return useQuery({
    queryKey: ['shifts', 'active'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as Shift | null;
    },
    refetchInterval: 30000,
  });
}

export function useShiftHistory(limit = 10) {
  return useQuery({
    queryKey: ['shifts', 'history', limit],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: shifts, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })
        .limit(limit);

      if (error) throw error;

      if (!shifts || shifts.length === 0) return [];

      const userIds = [...new Set(shifts.map(s => s.user_id))];
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('*')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return shifts.map(shift => ({
        ...shift,
        cashier: profileMap.get(shift.user_id)
      }));
    },
  });
}

export function useOpenShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shiftData: OpenShiftData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('shifts')
        .insert({
          user_id: user.id,
          opening_float: shiftData.opening_float,
          status: 'open',
        })
        .select()
        .single();

      if (error) throw error;
      return data as Shift;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Shift opened successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to open shift');
    },
  });
}

export function useCloseShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ shiftId, closeData }: { shiftId: string; closeData: CloseShiftData }) => {
      const { data: shift, error: fetchError } = await supabase
        .from('shifts')
        .select('*')
        .eq('id', shiftId)
        .single();

      if (fetchError) throw fetchError;

      const expectedCash = (shift.opening_float || 0) + (shift.total_cash_sales || 0);
      const variance = closeData.actual_cash - expectedCash;

      const { data, error } = await supabase
        .from('shifts')
        .update({
          end_time: new Date().toISOString(),
          actual_cash: closeData.actual_cash,
          expected_cash: expectedCash,
          variance: variance,
          notes: closeData.notes || null,
          status: 'closed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', shiftId)
        .select()
        .single();

      if (error) throw error;
      return data as Shift;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Shift closed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to close shift');
    },
  });
}

export function useShift(shiftId: string | undefined) {
  return useQuery({
    queryKey: ['shifts', shiftId],
    queryFn: async () => {
      if (!shiftId) return null;

      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('id', shiftId)
        .single();

      if (error) throw error;
      return data as Shift;
    },
    enabled: !!shiftId,
  });
}
