import { useState } from 'react';
import { Plus, Eye, Package, Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { usePurchaseOrders } from '../../hooks/usePurchaseOrders';
import { CreatePOModal } from './CreatePOModal';
import { ViewPOModal } from './ViewPOModal';
import { useCurrency } from '../../contexts/CurrencyContext';
import { format } from 'date-fns';

export function PurchaseOrdersPage() {
  const { formatCurrency } = useCurrency();
  const { data: purchaseOrders, isLoading } = usePurchaseOrders();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewingPO, setViewingPO] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'received':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">Loading purchase orders...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-600 mt-1">Manage procurement and stock receiving</p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Purchase Order
        </Button>
      </div>

      {!purchaseOrders || purchaseOrders.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No purchase orders yet. Create your first PO to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {purchaseOrders.map((po) => (
            <Card key={po.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg text-gray-900">{po.po_number}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(po.status)}`}>
                        {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-gray-500">Supplier</p>
                        <p className="font-medium text-gray-900">
                          {po.suppliers?.name || po.supplier_name || 'No supplier'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Amount</p>
                        <p className="font-medium text-gray-900">
                          {formatCurrency(po.total_amount || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Created</p>
                        <p className="font-medium text-gray-900">
                          {format(new Date(po.created_at), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewingPO(po.id)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreatePOModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      {viewingPO && (
        <ViewPOModal
          isOpen={!!viewingPO}
          onClose={() => setViewingPO(null)}
          poId={viewingPO}
        />
      )}
    </div>
  );
}
