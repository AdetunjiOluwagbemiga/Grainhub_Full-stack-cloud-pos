export const CURRENCY_OPTIONS = [
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
] as const;

export type CurrencyCode = typeof CURRENCY_OPTIONS[number]['code'];

export function getCurrencySymbol(code: CurrencyCode): string {
  const currency = CURRENCY_OPTIONS.find(c => c.code === code);
  return currency?.symbol || '₦';
}

export function formatCurrency(amount: number, currencyCode: CurrencyCode = 'NGN'): string {
  const symbol = getCurrencySymbol(currencyCode);
  const formattedAmount = amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${symbol}${formattedAmount}`;
}
