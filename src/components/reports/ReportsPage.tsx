import { useState } from 'react';
import { BarChart3, Download, Calendar, DollarSign, TrendingUp, Package, Percent, ShoppingCart, Clock } from 'lucide-react';
import { useSales } from '../../hooks/useSales';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { useCurrency } from '../../contexts/CurrencyContext';
import { formatShortDate } from '../../lib/utils';
import { exportSalesToExcel } from '../../lib/excelUtils';
import { ShiftReportsPage } from './ShiftReportsPage';
import toast from 'react-hot-toast';

export function ReportsPage() {
  const { formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState<'sales' | 'shifts'>('sales');

  const getMonthStart = () => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  };

  const getToday = () => {
    return new Date().toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(getMonthStart());
  const [endDate, setEndDate] = useState(getToday());

  const { data: sales, isLoading } = useSales(
    startDate || undefined,
    endDate || undefined
  );

  const completedSales = sales?.filter(s => s.status === 'completed') || [];

  const totalSales = completedSales.reduce((sum, sale) => sum + sale.total_amount, 0);
  const totalTransactions = completedSales.length;
  const totalDiscount = completedSales.reduce((sum, sale) => sum + sale.discount_amount, 0);
  const totalTax = completedSales.reduce((sum, sale) => sum + sale.tax_amount, 0);
  const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

  const totalCost = completedSales.reduce((sum, sale) => sum + (sale.total_cost || 0), 0);
  const totalProfit = completedSales.reduce((sum, sale) => sum + (sale.total_profit || 0), 0);
  const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;
  const grossRevenue = totalSales - totalDiscount;
  const itemsSold = completedSales.reduce((sum, sale) =>
    sum + (sale.sale_items?.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0) || 0), 0
  );

  const exportToExcel = () => {
    if (completedSales.length === 0) {
      toast.error('No sales data to export');
      return;
    }
    exportSalesToExcel(completedSales);
    toast.success('Sales report exported successfully!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Reports & Analytics</h1>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setActiveTab('sales')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'sales'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <BarChart3 className="w-4 h-4 inline mr-2" />
                Sales Reports
              </button>
              <button
                onClick={() => setActiveTab('shifts')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'shifts'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Clock className="w-4 h-4 inline mr-2" />
                Shift Reports
              </button>
            </div>
          </div>
          {activeTab === 'sales' && (
            <Button onClick={exportToExcel} disabled={completedSales.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Export to Excel
            </Button>
          )}
        </div>
      </div>

      {activeTab === 'shifts' ? (
        <ShiftReportsPage />
      ) : (
        <div className="p-4 sm:p-6 flex-1 overflow-auto">
          <Card className="mb-6">
            <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                type="date"
                label="Start Date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                type="date"
                label="End Date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Sales</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(totalSales)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Profit</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {formatCurrency(totalProfit)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Profit Margin</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {profitMargin.toFixed(1)}%
                  </p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Percent className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Items Sold</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{itemsSold}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Transactions</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{totalTransactions}</p>
                </div>
                <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-sky-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Transaction</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(averageTransaction)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Cost</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(totalCost)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Sale #
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Cashier
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Items
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      Total
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {completedSales.slice(0, 20).map((sale) => (
                    <tr key={sale.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900">{sale.sale_number}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {formatShortDate(sale.created_at)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {sale.cashier?.full_name || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {sale.sale_items?.length || 0}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(sale.total_amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                          sale.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : sale.status === 'voided'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {sale.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {completedSales.length === 0 && (
                <div className="py-12 text-center text-gray-600">
                  No sales data available for the selected period
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  );
}
