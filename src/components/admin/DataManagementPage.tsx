import { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, RotateCcw, Database, Shield, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { useCurrency } from '../../contexts/CurrencyContext';
import { format } from 'date-fns';

interface Sale {
  id: string;
  created_at: string;
  total_amount: number;
  payment_method: string;
  status: string;
  customer?: {
    name: string;
  };
}

export function DataManagementPage() {
  const { formatCurrency } = useCurrency();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (showDeleteModal) {
      loadSales();
    }
  }, [showDeleteModal]);

  useEffect(() => {
    const filtered = sales.filter(sale => {
      const searchLower = searchTerm.toLowerCase();
      const customerName = sale.customer?.name?.toLowerCase() || '';
      const amount = formatCurrency(sale.total_amount).toLowerCase();
      const date = format(new Date(sale.created_at), 'MMM d, yyyy h:mm a').toLowerCase();

      return customerName.includes(searchLower) ||
             amount.includes(searchLower) ||
             date.includes(searchLower) ||
             sale.payment_method.toLowerCase().includes(searchLower);
    });
    setFilteredSales(filtered);
  }, [searchTerm, sales, formatCurrency]);

  const loadSales = async () => {
    setIsLoadingSales(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          created_at,
          total_amount,
          payment_method,
          status,
          customer:customers(name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setSales(data || []);
      setFilteredSales(data || []);
    } catch (error: any) {
      console.error('Error loading sales:', error);
      toast.error('Failed to load sales');
    } finally {
      setIsLoadingSales(false);
    }
  };

  const handleResetData = async () => {
    if (confirmText !== 'RESET ALL DATA') {
      toast.error('Please type the confirmation text exactly');
      return;
    }

    setIsResetting(true);
    try {
      const { data, error } = await supabase.rpc('reset_all_data');

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message);
        setShowResetConfirm(false);
        setConfirmText('');
      } else {
        toast.error(data?.error || 'Failed to reset data');
      }
    } catch (error: any) {
      console.error('Error resetting data:', error);
      toast.error(error.message || 'Failed to reset data');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteSale = async () => {
    if (!selectedSale) return;

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.rpc('delete_sale_transaction', {
        p_sale_id: selectedSale.id
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Transaction deleted successfully');
        setSelectedSale(null);
        loadSales();
      } else {
        toast.error(data?.error || 'Failed to delete transaction');
      }
    } catch (error: any) {
      console.error('Error deleting sale:', error);
      toast.error(error.message || 'Failed to delete transaction');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Data Management</h1>
        <p className="text-gray-600 mt-1">
          Manage system data, audit logs, and perform administrative tasks
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Trash2 className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Delete Transactions
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Delete specific sale transactions individually. This will remove the sale and restore inventory quantities.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800 font-medium">
                  ℹ️ Safe deletion
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Inventory will be automatically restored for deleted transactions
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(true)}
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                <Search className="w-4 h-4 mr-2" />
                View Transactions
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Reset All Data
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                This will permanently delete all transactional data including sales, purchases,
                stock movements, and shifts. Product catalog, customers, suppliers, and users will be preserved.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-800 font-medium">
                  ⚠️ This action cannot be undone
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Use this before launching your business to remove test data
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowResetConfirm(true)}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Reset All Data
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Database className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                What Will Be Deleted
              </h2>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                  All sales and sale items
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                  All purchase orders
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                  All stock movements
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                  All shift records
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                  Inventory quantities (reset to 0)
                </li>
              </ul>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                What Will Be Kept
              </h2>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  All products and variants
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  Categories and barcodes
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  Customers and suppliers
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  User accounts and settings
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  Locations and system settings
                </li>
              </ul>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <RotateCcw className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Audit Trail
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                All data reset operations are logged in the audit trail with timestamp and admin details.
                The audit log cannot be deleted and serves as a permanent record.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  <strong>Security Note:</strong> This feature is restricted to admin users only.
                  All actions are logged and traceable.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        isOpen={showResetConfirm}
        onClose={() => {
          setShowResetConfirm(false);
          setConfirmText('');
        }}
        title="Confirm Data Reset"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">
                  This will permanently delete all transactional data
                </h3>
                <p className="text-sm text-red-700">
                  This action cannot be undone. All sales, purchases, stock movements, and shifts
                  will be deleted. Your product catalog, customers, and settings will remain intact.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type <span className="font-mono font-bold">RESET ALL DATA</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="RESET ALL DATA"
              autoFocus
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowResetConfirm(false);
                setConfirmText('');
              }}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetData}
              disabled={confirmText !== 'RESET ALL DATA' || isResetting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isResetting ? 'Resetting...' : 'Reset All Data'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSearchTerm('');
          setSelectedSale(null);
        }}
        title="Delete Transactions"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by customer, amount, date, or payment method..."
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
            {isLoadingSales ? (
              <div className="p-8 text-center text-gray-500">
                Loading transactions...
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {searchTerm ? 'No transactions found' : 'No transactions available'}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">
                            {formatCurrency(sale.total_amount)}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                            {sale.payment_method}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {sale.customer?.name || 'Walk-in Customer'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(sale.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSale(sale)}
                        className="border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setSearchTerm('');
                setSelectedSale(null);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {selectedSale && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedSale(null)}
          title="Confirm Delete Transaction"
        >
          <div className="space-y-4">
            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-orange-900 mb-1">
                    Delete this transaction?
                  </h3>
                  <p className="text-sm text-orange-700 mb-3">
                    This will permanently delete this sale and restore inventory quantities.
                    This action cannot be undone.
                  </p>
                  <div className="bg-white rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-semibold">{formatCurrency(selectedSale.total_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Customer:</span>
                      <span className="font-semibold">{selectedSale.customer?.name || 'Walk-in'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-semibold">
                        {format(new Date(selectedSale.created_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Payment:</span>
                      <span className="font-semibold">{selectedSale.payment_method}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => setSelectedSale(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteSale}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? 'Deleting...' : 'Delete Transaction'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
