import { createContext, useContext, ReactNode } from 'react';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency as formatCurrencyUtil, CurrencyCode } from '../lib/currency';

interface CurrencyContextType {
  currency: CurrencyCode;
  currencySymbol: string;
  formatCurrency: (amount: number) => string;
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { data: settings, isLoading } = useSettings();

  const currency = (settings?.currency || 'NGN') as CurrencyCode;
  const currencySymbol = settings?.currency_symbol || '₦';

  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount, currency);
  };

  return (
    <CurrencyContext.Provider value={{ currency, currencySymbol, formatCurrency, isLoading }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
