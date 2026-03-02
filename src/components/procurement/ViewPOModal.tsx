import { useState } from 'react';
import { Package, CheckCircle, Printer } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { usePurchaseOrder, useUpdatePOStatus, useReceivePOItem } from '../../hooks/usePurchaseOrders';
import { formatCurrency } from '../../lib/utils';
import { format } from 'date-fns';

interface ViewPOModalProps {
  isOpen: boolean;
  onClose: () => void;
  poId: string;
}

export function ViewPOModal({ isOpen, onClose, poId }: ViewPOModalProps) {
  const { data: po, isLoading } = usePurchaseOrder(poId);
  const updateStatus = useUpdatePOStatus();
  const receiveItem = useReceivePOItem();
  const [receivingMode, setReceivingMode] = useState(false);
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});

  if (isLoading || !po) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Purchase Order">
        <div className="p-6 text-center text-gray-500">Loading...</div>
      </Modal>
    );
  }

  const handleSendPO = () => {
    updateStatus.mutate({ id: po.id, status: 'sent' });
  };

  const handleStartReceiving = () => {
    const initialQuantities: Record<string, number> = {};
    po.purchase_order_items?.forEach(item => {
      initialQuantities[item.id] = item.quantity_received || 0;
    });
    setReceivedQuantities(initialQuantities);
    setReceivingMode(true);
  };

  const handleReceiveItems = async () => {
    for (const [itemId, quantity] of Object.entries(receivedQuantities)) {
      const item = po.purchase_order_items?.find(i => i.id === itemId);
      if (item && quantity !== item.quantity_received) {
        await receiveItem.mutateAsync({ itemId, quantityReceived: quantity });
      }
    }
    setReceivingMode(false);
  };

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Purchase Order ${po.po_number}`}>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(po.status)}`}>
              {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
            </span>
          </div>
          {po.status === 'draft' && (
            <Button size="sm" onClick={handleSendPO}>
              Send to Supplier
            </Button>
          )}
          {(po.status === 'sent' || po.status === 'partial') && !receivingMode && (
            <Button size="sm" onClick={handleStartReceiving}>
              <Package className="w-4 h-4 mr-1" />
              Receive Stock
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-200">
          <div>
            <p className="text-sm text-gray-500">Supplier</p>
            <p className="font-medium">{po.suppliers?.name || 'No supplier'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Amount</p>
            <p className="font-medium">{formatCurrency(po.total_amount || 0)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created</p>
            <p className="font-medium">{format(new Date(po.created_at), 'MMM dd, yyyy')}</p>
          </div>
          {po.expected_delivery && (
            <div>
              <p className="text-sm text-gray-500">Expected Delivery</p>
              <p className="font-medium">{format(new Date(po.expected_delivery), 'MMM dd, yyyy')}</p>
            </div>
          )}
        </div>

        <div>
          <h3 className="font-semibold mb-3">Order Items</h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Product</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-700">Ordered</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-700">
                    {receivingMode ? 'Receive' : 'Received'}
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-gray-700">Unit Cost</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {po.purchase_order_items?.map(item => {
                  const product = item.products;
                  const totalCost = item.quantity * (item.unit_cost || item.cost_price);
                  const isFullyReceived = (item.quantity_received || 0) >= item.quantity;

                  return (
                    <tr key={item.id} className={isFullyReceived ? 'bg-green-50' : ''}>
                      <td className="px-3 py-2">
                        <div>
                          <div className="font-medium">{product?.name}</div>
                          <div className="text-xs text-gray-500">{product?.sku}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">
                        {receivingMode ? (
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            step="1"
                            value={receivedQuantities[item.id] || 0}
                            onChange={(e) =>
                              setReceivedQuantities({
                                ...receivedQuantities,
                                [item.id]: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-right"
                          />
                        ) : (
                          <span className={isFullyReceived ? 'text-green-700 font-medium' : ''}>
                            {item.quantity_received || 0}
                            {isFullyReceived && <CheckCircle className="w-4 h-4 inline ml-1" />}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(item.unit_cost || item.cost_price)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatCurrency(totalCost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right font-semibold">Total:</td>
                  <td className="px-3 py-2 text-right font-bold">
                    {formatCurrency(po.total_amount || 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {po.notes && (
          <div>
            <h3 className="font-semibold mb-2">Notes</h3>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{po.notes}</p>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          {receivingMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => setReceivingMode(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReceiveItems}
                disabled={receiveItem.isPending}
                className="flex-1"
              >
                Confirm Receipt
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
