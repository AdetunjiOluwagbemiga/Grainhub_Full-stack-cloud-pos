import { X, User, Calendar, CreditCard, Package, DollarSign } from 'lucide-react';
import { Button } from '../ui/Button';
import { useSaleById } from '../../hooks/useSales';
import { useProducts } from '../../hooks/useProducts';
import { formatCurrency } from '../../lib/currency';
import { format } from 'date-fns';

interface SaleDetailsModalProps {
  saleId: string;
  onClose: () => void;
}

export function SaleDetailsModal({ saleId, onClose }: SaleDetailsModalProps) {
  const { data: sale, isLoading, error } = useSaleById(saleId);
  const { data: products } = useProducts();

  if (!saleId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <div className="text-gray-500">Loading sale details...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-red-500 font-semibold mb-2">Error loading sale</div>
              <div className="text-gray-600 text-sm">{(error as Error).message}</div>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-gray-500 mb-4">Sale not found</div>
              <div className="text-gray-400 text-sm mb-4">ID: {saleId}</div>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getProductName = (productId: string, variantId: string | null) => {
    const product = products?.find((p) => p.id === productId);
    if (!product) return 'Unknown Product';

    if (variantId && product.variants) {
      const variant = product.variants.find((v) => v.id === variantId);
      if (variant) return `${product.name} - ${variant.name}`;
    }

    return product.name;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-h-[90vh] flex flex-col w-full max-w-4xl border border-gray-200/50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200/50 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-xl font-bold text-gray-900">Sale Details</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="space-y-6">
        {/* Header Info */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <div className="text-sm text-gray-500">Sale Number</div>
            <div className="font-semibold text-gray-900">{sale.sale_number}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Status</div>
            <div className="font-semibold">
              <span
                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  sale.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : sale.status === 'voided'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {sale.status}
              </span>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Date & Time
            </div>
            <div className="font-medium text-gray-900">
              {format(new Date(sale.created_at), 'MMM dd, yyyy hh:mm a')}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <User className="w-4 h-4" />
              Cashier
            </div>
            <div className="font-medium text-gray-900">
              {sale.cashier?.full_name || 'Unknown'}
            </div>
          </div>
        </div>

        {/* Customer Info */}
        {sale.customer && (
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Customer Information</h3>
            <div className="space-y-1">
              <div className="text-sm">
                <span className="text-gray-500">Name:</span>{' '}
                <span className="font-medium">{sale.customer.name}</span>
              </div>
              {sale.customer.email && (
                <div className="text-sm">
                  <span className="text-gray-500">Email:</span>{' '}
                  <span className="font-medium">{sale.customer.email}</span>
                </div>
              )}
              {sale.customer.phone && (
                <div className="text-sm">
                  <span className="text-gray-500">Phone:</span>{' '}
                  <span className="font-medium">{sale.customer.phone}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Items */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Items Sold
          </h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Product
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Price
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Discount
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sale.sale_items.map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {getProductName(item.product_id, item.variant_id)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {item.discount_amount > 0 ? formatCurrency(item.discount_amount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                      {formatCurrency(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Details */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Payment Details
          </h3>
          <div className="space-y-2">
            {sale.payments && sale.payments.length > 0 ? (
              sale.payments.map((payment: any) => (
                <div key={payment.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {payment.payment_method?.name || 'Unknown Method'}
                  </span>
                  <span className="font-medium">{formatCurrency(payment.amount)}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500">No payment information</div>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">{formatCurrency(sale.subtotal)}</span>
          </div>
          {sale.discount_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Discount</span>
              <span className="font-medium text-red-600">
                -{formatCurrency(sale.discount_amount)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Tax</span>
            <span className="font-medium">{formatCurrency(sale.tax_amount)}</span>
          </div>
          <div className="flex justify-between text-lg font-semibold border-t pt-2">
            <span className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Total
            </span>
            <span>{formatCurrency(sale.total_amount)}</span>
          </div>
        </div>

        {/* Void Information */}
        {sale.status === 'voided' && sale.void_reason && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-sm font-semibold text-red-800 mb-2">Void Information</h3>
            <div className="text-sm text-red-700">
              <div>
                <span className="font-medium">Reason:</span> {sale.void_reason}
              </div>
              {sale.voided_at && (
                <div>
                  <span className="font-medium">Voided at:</span>{' '}
                  {format(new Date(sale.voided_at), 'MMM dd, yyyy hh:mm a')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {sale.notes && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Notes</h3>
            <p className="text-sm text-blue-700">{sale.notes}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
