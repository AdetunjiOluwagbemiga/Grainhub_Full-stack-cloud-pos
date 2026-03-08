import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { CurrencyCode } from '../lib/currency';

export interface SystemSettings {
  currency: CurrencyCode;
  currency_symbol: string;
  tax_rate: number;
  tax_inclusive: boolean;
  store_name: string;
  store_address: string;
  store_phone: string;
  store_email: string;
  receipt_header: string;
  receipt_footer: string;
  auto_print_receipt: boolean;
  date_format: string;
}

interface SettingRow {
  setting_key: string;
  setting_value: string;
}

export function useSettings() {
  return useQuery({
    queryKey: ['system_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value');

      if (error) throw error;

      const settings: Partial<SystemSettings> = {};
      (data as SettingRow[]).forEach((row) => {
        const key = row.setting_key as keyof SystemSettings;
        let value: string | number | boolean = row.setting_value;

        if (key === 'tax_rate') {
          value = parseFloat(row.setting_value);
        } else if (key === 'tax_inclusive' || key === 'auto_print_receipt') {
          value = row.setting_value === 'true';
        }

        settings[key] = value as never;
      });

      return settings as SystemSettings;
    },
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string | number | boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const stringValue = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);

      const { error } = await supabase.rpc('update_setting', {
        p_key: key,
        p_value: stringValue,
        p_user_id: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system_settings'] });
    },
  });
}
