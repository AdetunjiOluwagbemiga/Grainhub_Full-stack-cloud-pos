import { format } from 'date-fns';
import { X, User, DollarSign, TrendingUp, Clock, CreditCard } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { formatCurrency } from '../../lib/currency';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useState } from 'react';
import { SaleDetailsModal } from './SaleDetailsModal';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

interface ShiftDetailsModalProps {
  shift: any;
  onClose: () => void;
}

export function ShiftDetailsModal({ shift, onClose }: ShiftDetailsModalProps) {
  const { currency } = useCurrency();
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  const { data: shiftSales = [] } = useQuery({
    queryKey: ['shift-sales', shift.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers(*),
          cashier:user_profiles!sales_cashier_id_fkey(*),
          sale_items(*),
          payments(*, payment_method:payment_methods(*))
        `)
        .eq('shift_id', shift.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const totalSalesCount = shiftSales.length;
  const averageTransaction = totalSalesCount > 0 ? shift.total_sales / totalSalesCount : 0;

  const paymentBreakdown = shiftSales.reduce((acc: any, sale: any) => {
    sale.payments?.forEach((payment: any) => {
      const method = payment.payment_method?.name || 'Unknown';
      if (!acc[method]) {
        acc[method] = 0;
      }
      acc[method] += payment.amount;
    });
    return acc;
  }, {});

  const shiftDuration = shift.end_time
    ? Math.round((new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / (1000 * 60))
    : Math.round((new Date().getTime() - new Date(shift.start_time).getTime()) / (1000 * 60));

  const hours = Math.floor(shiftDuration / 60);
  const minutes = shiftDuration % 60;

  return (
    <>
      <Modal isOpen={true} onClose={onClose} title="Shift Details" size="xl">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-gray-600 mb-3">
                <User className="w-5 h-5" />
                <span className="font-medium">Shift Information</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Cashier:</span>
                  <span className="font-medium">{shift.cashier?.full_name || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ${shift.status === 'open' ? 'text-green-600' : 'text-gray-600'}`}>
                    {shift.status === 'open' ? 'Open' : 'Closed'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Opened:</span>
                  <span className="font-medium">{format(new Date(shift.start_time), 'MMM dd, yyyy HH:mm')}</span>
                </div>
                {shift.end_time && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Closed:</span>
                    <span className="font-medium">{format(new Date(shift.end_time), 'MMM dd, yyyy HH:mm')}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-600 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Duration:
                  </span>
                  <span className="font-medium">{hours}h {minutes}m</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-gray-600 mb-3">
                <DollarSign className="w-5 h-5" />
                <span className="font-medium">Financial Summary</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Opening Float:</span>
                  <span className="font-medium">{formatCurrency(shift.opening_float, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Sales:</span>
                  <span className="font-medium text-green-600">{formatCurrency(shift.total_sales, currency)}</span>
                </div>
                {shift.actual_cash !== null && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expected Cash:</span>
                      <span className="font-medium">{formatCurrency(shift.expected_cash, currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Actual Cash:</span>
                      <span className="font-medium">{formatCurrency(shift.actual_cash, currency)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-gray-600">Variance:</span>
                      <span className={`font-medium ${shift.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(shift.variance, currency)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-gray-600 mb-3">
              <TrendingUp className="w-5 h-5" />
              <span className="font-medium">Sales Metrics</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Total Transactions</div>
                <div className="text-2xl font-bold text-gray-900">{totalSalesCount}</div>
              </div>
              <div>
                <div className="text-gray-600">Average Transaction</div>
                <div className="text-2xl font-bold text-gray-900">{formatCurrency(averageTransaction, currency)}</div>
              </div>
              <div>
                <div className="text-gray-600">Sales/Hour</div>
                <div className="text-2xl font-bold text-gray-900">
                  {hours > 0 ? Math.round(totalSalesCount / hours) : totalSalesCount}
                </div>
              </div>
              <div>
                <div className="text-gray-600">Revenue/Hour</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(hours > 0 ? shift.total_sales / hours : shift.total_sales, currency)}
                </div>
              </div>
            </div>
          </div>

          {Object.keys(paymentBreakdown).length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-gray-600 mb-3">
                <CreditCard className="w-5 h-5" />
                <span className="font-medium">Payment Methods</span>
              </div>
              <div className="space-y-2">
                {Object.entries(paymentBreakdown).map(([method, amount]: [string, any]) => (
                  <div key={method} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">{method}</span>
                    <span className="font-medium">{formatCurrency(amount, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-medium text-gray-900 mb-3">Transactions ({totalSalesCount})</h3>
            <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {shiftSales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No transactions in this shift
                      </td>
                    </tr>
                  ) : (
                    shiftSales.map((sale) => (
                      <tr
                        key={sale.id}
                        onClick={() => setSelectedSaleId(sale.id)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {format(new Date(sale.sale_date), 'HH:mm:ss')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {sale.receipt_number}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {sale.customer?.name || 'Walk-in'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {sale.sale_items?.length || 0}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          {formatCurrency(sale.total_amount, currency)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {shift.notes && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Notes</h3>
              <p className="text-sm text-gray-600">{shift.notes}</p>
            </div>
          )}
        </div>
      </Modal>

      {selectedSaleId && (
        <SaleDetailsModal
          saleId={selectedSaleId}
          onClose={() => setSelectedSaleId(null)}
        />
      )}
    </>
  );
}
