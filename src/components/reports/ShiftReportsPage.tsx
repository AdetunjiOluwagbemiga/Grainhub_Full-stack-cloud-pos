import { useState } from 'react';
import { Clock, DollarSign, TrendingUp, TrendingDown, CheckCircle, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { useShiftHistory } from '../../hooks/useShifts';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { format } from 'date-fns';

export function ShiftReportsPage() {
  const { formatCurrency } = useCurrency();
  const { profile } = useAuth();
  const [limit, setLimit] = useState(20);
  const { data: shifts, isLoading } = useShiftHistory(limit);

  const isManager = profile?.role === 'admin' || profile?.role === 'manager';

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">Loading shift history...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shift Reports</h1>
        <p className="text-gray-600 mt-1">View your shift history and financial reconciliation</p>
      </div>

      {!shifts || shifts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No shift history available</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {shifts.map((shift) => {
            const variance = shift.variance || 0;
            const isShort = variance < 0;
            const isOver = variance > 0;

            return (
              <Card key={shift.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        shift.status === 'open'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {shift.status === 'open' ? (
                          <Clock className="w-5 h-5" />
                        ) : (
                          <CheckCircle className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {format(new Date(shift.start_time), 'MMM dd, yyyy')}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {format(new Date(shift.start_time), 'hh:mm a')} -
                          {shift.end_time
                            ? format(new Date(shift.end_time), ' hh:mm a')
                            : ' Present'}
                        </p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      shift.status === 'open'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {shift.status === 'open' ? 'Active' : 'Closed'}
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-3">Sales Summary</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Transactions:</span>
                          <span className="font-medium">{shift.transaction_count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Total Sales:</span>
                          <span className="font-medium">{formatCurrency(shift.total_sales)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Discounts:</span>
                          <span className="font-medium text-red-600">-{formatCurrency(shift.total_discounts)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Tax Collected:</span>
                          <span className="font-medium">{formatCurrency(shift.total_tax)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-3">Payment Breakdown</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Cash:</span>
                          <span className="font-medium">{formatCurrency(shift.total_cash_sales)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Card:</span>
                          <span className="font-medium">{formatCurrency(shift.total_card_sales)}</span>
                        </div>
                      </div>
                    </div>

                    {shift.status === 'closed' && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-3">Cash Reconciliation</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Opening Float:</span>
                            <span className="font-medium">{formatCurrency(shift.opening_float)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Expected:</span>
                            <span className="font-medium">{formatCurrency(shift.expected_cash)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Actual:</span>
                            <span className="font-medium">{formatCurrency(shift.actual_cash || 0)}</span>
                          </div>
                          {isManager && (
                            <div className={`flex justify-between pt-2 border-t ${
                              isShort ? 'border-red-200' : isOver ? 'border-green-200' : 'border-gray-200'
                            }`}>
                              <span className={`text-sm font-semibold ${
                                isShort ? 'text-red-700' : isOver ? 'text-green-700' : 'text-gray-700'
                              }`}>
                                Variance:
                              </span>
                              <div className="flex items-center gap-1">
                                {isShort && <TrendingDown className="w-4 h-4 text-red-600" />}
                                {isOver && <TrendingUp className="w-4 h-4 text-green-600" />}
                                <span className={`font-bold ${
                                  isShort ? 'text-red-600' : isOver ? 'text-green-600' : 'text-gray-900'
                                }`}>
                                  {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {shift.notes && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Notes</h4>
                      <p className="text-sm text-gray-700">{shift.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {shifts.length >= limit && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={() => setLimit(limit + 20)}
              >
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
