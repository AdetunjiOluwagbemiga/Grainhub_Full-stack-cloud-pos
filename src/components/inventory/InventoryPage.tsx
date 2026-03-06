import { useState, useRef } from 'react';
import { Package, AlertTriangle, Plus, Minus, Download, Upload, FileDown } from 'lucide-react';
import { useInventory, useLowStockItems, useStockAdjustment } from '../../hooks/useInventory';
import { useInventoryValuation } from '../../hooks/useValuation';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { formatCurrency } from '../../lib/utils';
import { exportInventoryToExcel, importInventoryFromExcel, downloadInventoryTemplate } from '../../lib/excelUtils';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export function InventoryPage() {
  const { data: rawInventory, isLoading: rawLoading } = useInventory();
  const { data: groupedInventory, isLoading: valuationLoading } = useInventoryValuation();
  const { data: lowStock } = useLowStockItems();
  const stockAdjustment = useStockAdjustment();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = rawLoading || valuationLoading;

  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [adjustment, setAdjustment] = useState({
    quantity_change: '',
    reason: 'correction',
    notes: '',
  });

  const handleAdjustment = async () => {
    if (!selectedItem || !adjustment.quantity_change) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await stockAdjustment.mutateAsync({
        location_id: selectedItem.location_id,
        product_id: selectedItem.product_id,
        variant_id: selectedItem.variant_id,
        quantity_change: parseFloat(adjustment.quantity_change),
        reason: adjustment.reason,
        notes: adjustment.notes || null,
        adjusted_by: null,
      });

      setAdjustModalOpen(false);
      setSelectedItem(null);
      setAdjustment({ quantity_change: '', reason: 'correction', notes: '' });
    } catch (error) {
      console.error('Error adjusting stock:', error);
    }
  };

  const handleExport = () => {
    if (!rawInventory || rawInventory.length === 0) {
      toast.error('No inventory to export');
      return;
    }
    exportInventoryToExcel(rawInventory);
    toast.success('Inventory exported successfully!');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please select an Excel file (.xlsx or .xls)');
      return;
    }

    const mainLocationId = 'eb23cc18-3aa6-4a73-9115-ed493974c5fa';

    setImporting(true);
    const toastId = toast.loading('Importing inventory...');

    try {
      const result = await importInventoryFromExcel(file, mainLocationId);

      await queryClient.invalidateQueries({ queryKey: ['inventory'] });

      if (result.errors.length > 0) {
        toast.error(
          `Imported ${result.success} items with ${result.errors.length} errors. Check console for details.`,
          { id: toastId, duration: 5000 }
        );
        console.error('Import errors:', result.errors);
      } else {
        toast.success(`Successfully imported ${result.success} inventory items!`, { id: toastId });
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to import inventory', { id: toastId });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = () => {
    downloadInventoryTemplate();
    toast.success('Template downloaded!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Inventory Management</h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleDownloadTemplate} size="sm" className="flex-1 sm:flex-none">
              <FileDown className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Download Template</span>
            </Button>
            <Button variant="secondary" onClick={handleImportClick} disabled={importing} size="sm" className="flex-1 sm:flex-none">
              <Upload className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{importing ? 'Importing...' : 'Import Excel'}</span>
            </Button>
            <Button variant="secondary" onClick={handleExport} size="sm" className="flex-1 sm:flex-none">
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Export Excel</span>
            </Button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <div className="p-4 sm:p-6 flex-1 overflow-auto">
        {lowStock && lowStock.length > 0 && (
          <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardHeader>
              <div className="flex items-center gap-2 text-orange-800">
                <AlertTriangle className="w-5 h-5" />
                <h2 className="font-semibold">Low Stock Alert</h2>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lowStock.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-900">
                      {item.product?.name || item.variant?.variant_name}
                    </span>
                    <span className="text-orange-600 font-medium">
                      {item.quantity} remaining
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4">
          {groupedInventory?.map((item: any) => (
            <Card key={item.product_id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-gray-400" />
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {item.product_name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          SKU: {item.sku}
                          {item.category_name && ` · ${item.category_name}`}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                      <div>
                        <span className="text-xs text-gray-500">Current Stock</span>
                        <p className={`text-lg font-bold ${item.has_negative_stock ? 'text-red-600' : 'text-gray-900'}`}>
                          {item.stock_quantity}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Cost Price</span>
                        <p className="font-medium text-gray-900">{formatCurrency(item.cost_price)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Retail Price</span>
                        <p className="font-medium text-gray-900">{formatCurrency(item.retail_price)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Asset Value</span>
                        <p className="font-medium text-green-600">{formatCurrency(item.total_cost_value)}</p>
                      </div>
                    </div>

                    {item.has_negative_stock && (
                      <div className="mt-3 bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">
                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                        Warning: Negative stock detected
                      </div>
                    )}

                    {item.stock_status === 'low_stock' && (
                      <div className="mt-3 bg-orange-50 border border-orange-200 rounded px-3 py-2 text-sm text-orange-700">
                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                        Low stock alert
                      </div>
                    )}
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const rawItem = rawInventory?.find(inv =>
                        inv.product_id === item.product_id &&
                        (!inv.variant_id || inv.variant_id === item.variant_id)
                      );
                      if (rawItem) {
                        setSelectedItem(rawItem);
                        setAdjustModalOpen(true);
                      } else {
                        toast.error('Cannot adjust stock for this product');
                      }
                    }}
                  >
                    Adjust Stock
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {groupedInventory?.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">No inventory items found</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Modal
        isOpen={adjustModalOpen}
        onClose={() => {
          setAdjustModalOpen(false);
          setSelectedItem(null);
        }}
        title="Adjust Stock"
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900">
                {selectedItem.product?.name || selectedItem.variant?.variant_name}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Current Stock: <span className="font-semibold">{selectedItem.quantity}</span>
              </p>
            </div>

            <Input
              label="Quantity Change (+ to add, - to remove)"
              type="number"
              step="0.01"
              placeholder="e.g., +10 or -5"
              value={adjustment.quantity_change}
              onChange={(e) => setAdjustment({ ...adjustment, quantity_change: e.target.value })}
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason
              </label>
              <select
                value={adjustment.reason}
                onChange={(e) => setAdjustment({ ...adjustment, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="correction">Stock Correction</option>
                <option value="shrinkage">Shrinkage</option>
                <option value="damage">Damage</option>
                <option value="found">Stock Found</option>
                <option value="return">Customer Return</option>
              </select>
            </div>

            <Input
              label="Notes (optional)"
              value={adjustment.notes}
              onChange={(e) => setAdjustment({ ...adjustment, notes: e.target.value })}
              placeholder="Additional details..."
            />

            <div className="flex gap-3 pt-4">
              <Button
                className="flex-1"
                onClick={handleAdjustment}
                disabled={!adjustment.quantity_change}
              >
                Apply Adjustment
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setAdjustModalOpen(false);
                  setSelectedItem(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
