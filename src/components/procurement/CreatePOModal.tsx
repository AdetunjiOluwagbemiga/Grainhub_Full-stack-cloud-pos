import { useState } from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useSuppliers } from '../../hooks/useSuppliers';
import { useProducts } from '../../hooks/useProducts';
import { useInventory } from '../../hooks/useInventory';
import { useCreatePurchaseOrder, useLowStockProducts } from '../../hooks/usePurchaseOrders';
import { formatCurrency } from '../../lib/utils';

interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface POLineItem {
  product_id: string;
  product_name: string;
  current_stock: number;
  quantity: number;
  unit_cost: number;
}

export function CreatePOModal({ isOpen, onClose }: CreatePOModalProps) {
  const { data: suppliers } = useSuppliers();
  const { data: products } = useProducts();
  const { data: inventory } = useInventory();
  const { data: lowStockItems } = useLowStockProducts();
  const createPO = useCreatePurchaseOrder();

  const [supplierId, setSupplierId] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<POLineItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');

  const activeSuppliers = suppliers?.filter(s => s.is_active) || [];

  const handleAutoFillLowStock = () => {
    if (!lowStockItems || !products || !inventory) return;

    const lowStockPOItems: POLineItem[] = lowStockItems.map(item => {
      const product = products.find(p => p.id === item.product_id);
      const suggestedQty = (item.low_stock_threshold || 10) * 2;

      return {
        product_id: item.product_id,
        product_name: product?.name || 'Unknown',
        current_stock: item.quantity,
        quantity: suggestedQty,
        unit_cost: product?.cost_price || 0,
      };
    });

    setItems(lowStockPOItems);
  };

  const handleAddProduct = () => {
    if (!selectedProduct || !products || !inventory) return;

    const product = products.find(p => p.id === selectedProduct);
    const inventoryItem = inventory.find(i => i.product_id === selectedProduct);

    if (!product) return;

    if (items.some(item => item.product_id === selectedProduct)) {
      return;
    }

    setItems([
      ...items,
      {
        product_id: product.id,
        product_name: product.name,
        current_stock: inventoryItem?.quantity || 0,
        quantity: 1,
        unit_cost: product.cost_price,
      },
    ]);

    setSelectedProduct('');
  };

  const handleUpdateItem = (index: number, field: keyof POLineItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      return;
    }

    createPO.mutate(
      {
        supplier_id: supplierId,
        expected_delivery: expectedDelivery || undefined,
        notes: notes || undefined,
        items: items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
        })),
      },
      {
        onSuccess: () => {
          setSupplierId('');
          setExpectedDelivery('');
          setNotes('');
          setItems([]);
          onClose();
        },
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Purchase Order">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Supplier
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select supplier...</option>
              {activeSuppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Expected Delivery"
            type="date"
            value={expectedDelivery}
            onChange={(e) => setExpectedDelivery(e.target.value)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Products
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAutoFillLowStock}
            >
              <AlertCircle className="w-4 h-4 mr-1" />
              Auto-fill Low Stock
            </Button>
          </div>

          <div className="flex gap-2 mb-3">
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select product to add...</option>
              {products
                ?.filter(p => !items.some(item => item.product_id === p.id))
                .map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} - {product.sku}
                  </option>
                ))}
            </select>
            <Button
              type="button"
              size="sm"
              onClick={handleAddProduct}
              disabled={!selectedProduct}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-500">
              <p>No products added yet</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Product</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-700">Stock</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-700">Qty</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-700">Unit Cost</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-700">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2">{item.product_name}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{item.current_stock}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(index, 'quantity', parseFloat(e.target.value))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) => handleUpdateItem(index, 'unit_cost', parseFloat(e.target.value))}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatCurrency(item.quantity * item.unit_cost)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-right font-semibold">Total:</td>
                    <td className="px-3 py-2 text-right font-bold text-lg">
                      {formatCurrency(totalAmount)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createPO.isPending || items.length === 0}
            className="flex-1"
          >
            Create Purchase Order
          </Button>
        </div>
      </form>
    </Modal>
  );
}
