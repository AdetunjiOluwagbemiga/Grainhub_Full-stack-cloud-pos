import { useState } from 'react';
import { AlertTriangle, Calendar, Package, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useExpiringProducts, useExpiryStatistics } from '../../hooks/useExpiry';
import { format, differenceInDays } from 'date-fns';

export function ExpiryTrackingPage() {
  const { formatCurrency } = useCurrency();
  const [daysAhead, setDaysAhead] = useState(30);
  const { data: expiringProducts, isLoading } = useExpiringProducts(daysAhead);
  const { data: statistics } = useExpiryStatistics();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'expired':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'critical':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (daysUntilExpiry: number) => {
    if (daysUntilExpiry < 0) return 'Expired';
    if (daysUntilExpiry === 0) return 'Expires Today';
    if (daysUntilExpiry === 1) return 'Expires Tomorrow';
    return `${daysUntilExpiry} days left`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expiry Tracking</h1>
          <p className="text-gray-600 mt-1">Monitor products approaching expiration dates</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Show products expiring within:</label>
          <select
            value={daysAhead}
            onChange={(e) => setDaysAhead(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Expired Products</p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {statistics?.expired_count || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Value: {formatCurrency(Number(statistics?.expired_value || 0))}
                </p>
              </div>
              <div className="bg-red-100 p-3 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Expiring in 7 Days</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">
                  {statistics?.expiring_7days || 0}
                </p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <Calendar className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Expiring in 30 Days</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">
                  {statistics?.expiring_30days || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Value: {formatCurrency(Number(statistics?.expiring_value || 0))}
                </p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Package className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Items at Risk</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {expiringProducts?.length || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Within {daysAhead} days
                </p>
              </div>
              <div className="bg-gray-100 p-3 rounded-lg">
                <TrendingDown className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Products Expiring Soon</h2>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : expiringProducts && expiringProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {expiringProducts.map((product: any) => {
                    const daysLeft = differenceInDays(new Date(product.expiry_date), new Date());
                    const status = daysLeft < 0 ? 'expired' : daysLeft <= 7 ? 'critical' : daysLeft <= 30 ? 'warning' : 'normal';

                    return (
                      <tr key={product.inventory_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{product.product_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{product.sku}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {product.batch_number || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {format(new Date(product.expiry_date), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
                            {getStatusLabel(daysLeft)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {Number(product.quantity).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                          {formatCurrency(Number(product.total_value))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No products expiring within the selected timeframe</p>
              <p className="text-sm text-gray-500 mt-1">
                Products with expiry dates will appear here as they approach expiration
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
