import { useState } from 'react';
import { X, User, Calendar, CreditCard, Package, DollarSign, AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useSaleById, useDeleteSale } from '../../hooks/useSales';
import { useProducts } from '../../hooks/useProducts';
import { formatCurrency } from '../../lib/currency';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

interface SaleDetailsModalProps {
  saleId: string;
  onClose: () => void;
}

export function SaleDetailsModal({ saleId, onClose }: SaleDetailsModalProps) {
  const { data: sale, isLoading, error, refetch } = useSaleById(saleId);
  const { data: products } = useProducts();
  const { isAdmin } = useAuth();
  const deleteSale = useDeleteSale();
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  console.log('Modal - saleId:', saleId, 'sale:', sale, 'isLoading:', isLoading, 'error:', error);

  if (isLoading) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Sale Details" size="lg">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading...</div>
        </div>
      </Modal>
    );
  }

  if (error) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Sale Details" size="lg">
        <div className="flex items-center justify-center py-12">
          <div className="text-red-500">Error loading sale: {(error as Error).message}</div>
        </div>
      </Modal>
    );
  }

  if (!sale) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Sale Details" size="lg">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Sale not found (ID: {saleId})</div>
        </div>
      </Modal>
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

  const handleVoidSale = async () => {
    if (!voidReason.trim()) {
      toast.error('Please provide a reason for voiding this sale');
      return;
    }

    setIsVoiding(true);
    try {
      const { data, error } = await supabase.rpc('void_sale', {
        p_sale_id: saleId,
        p_reason: voidReason,
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Sale voided successfully');
        await refetch();
        setShowVoidConfirm(false);
        setVoidReason('');
      } else {
        toast.error(data?.error || 'Failed to void sale');
      }
    } catch (error: any) {
      console.error('Error voiding sale:', error);
      toast.error(error.message || 'Failed to void sale');
    } finally {
      setIsVoiding(false);
    }
  };

  const handleDeleteSale = async () => {
    try {
      await deleteSale.mutateAsync(saleId);
      setShowDeleteConfirm(false);
      onClose();
    } catch (error: any) {
      console.error('Error deleting sale:', error);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Sale Details" size="lg">
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
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex gap-2">
            {isAdmin && sale.status === 'completed' && !sale.is_voided && (
              <Button
                variant="outline"
                onClick={() => setShowVoidConfirm(true)}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Void Sale
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                className="border-red-500 text-red-800 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>

      {/* Void Confirmation Modal */}
      {showVoidConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Void Sale</h3>
                <p className="text-sm text-gray-600">
                  This will void sale #{sale.sale_number} and reverse inventory changes. This action
                  will be logged in the audit trail.
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for voiding <span className="text-red-500">*</span>
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                rows={3}
                placeholder="Enter reason for voiding this sale..."
                autoFocus
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowVoidConfirm(false);
                  setVoidReason('');
                }}
                disabled={isVoiding}
              >
                Cancel
              </Button>
              <Button
                onClick={handleVoidSale}
                disabled={!voidReason.trim() || isVoiding}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isVoiding ? 'Voiding...' : 'Void Sale'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Delete Sale Permanently</h3>
                <p className="text-sm text-gray-600 mb-3">
                  This will permanently delete sale #{sale.sale_number} and all related data.
                </p>
                <div className="bg-red-50 border border-red-200 rounded p-3 space-y-1">
                  <p className="text-sm font-semibold text-red-800">This action will:</p>
                  <ul className="text-xs text-red-700 space-y-1 ml-4 list-disc">
                    <li>Remove all sale records and items</li>
                    <li>Reverse inventory changes</li>
                    <li>Adjust shift totals and reports</li>
                    <li>Update customer statistics</li>
                    <li>Cannot be undone</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteSale.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteSale}
                disabled={deleteSale.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteSale.isPending ? 'Deleting...' : 'Delete Permanently'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
