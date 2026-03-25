import { useState } from 'react';
import { AlertTriangle, Trash2, RotateCcw, Database, Shield, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';

type DeleteType = 'products' | 'customers' | 'suppliers' | null;

export function DataManagementPage() {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteType, setDeleteType] = useState<DeleteType>(null);
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleResetData = async () => {
    if (confirmText !== 'RESET ALL DATA') {
      toast.error('Please type the confirmation text exactly');
      return;
    }

    setIsResetting(true);
    try {
      const { data, error } = await supabase.rpc('reset_all_data') as { data: any; error: any };

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

  const handleDeleteInactive = async () => {
    if (confirmText !== 'DELETE PERMANENTLY') {
      toast.error('Please type the confirmation text exactly');
      return;
    }

    setIsDeleting(true);
    try {
      let rpcFunction = '';
      if (deleteType === 'products') rpcFunction = 'delete_inactive_products';
      else if (deleteType === 'customers') rpcFunction = 'delete_inactive_customers';
      else if (deleteType === 'suppliers') rpcFunction = 'delete_inactive_suppliers';

      const { data, error } = await supabase.rpc(rpcFunction) as { data: any; error: any };

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message);
        setShowDeleteConfirm(false);
        setConfirmText('');
        setDeleteType(null);
      } else {
        toast.error(data?.error || 'Failed to delete data');
      }
    } catch (error: any) {
      console.error('Error deleting data:', error);
      toast.error(error.message || 'Failed to delete data');
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteModal = (type: DeleteType) => {
    setDeleteType(type);
    setShowDeleteConfirm(true);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Data Management</h1>
        <p className="text-gray-600 mt-1">
          Manage system data, audit logs, and perform administrative tasks
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
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
                  This action cannot be undone
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Use this before launching your business to remove test data
                </p>
              </div>
              <Button
                variant="secondary"
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
            <div className="p-3 bg-orange-100 rounded-lg">
              <XCircle className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Permanently Delete Inactive Items
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                When you mark products, customers, or suppliers as inactive in the app, they are hidden but still remain in the database.
                Use these options to permanently delete inactive items from your database.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-800 font-medium">
                  Permanent deletion cannot be undone
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Customers and suppliers with transaction history cannot be deleted
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={() => openDeleteModal('products')}
                  className="border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Delete Inactive Products
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => openDeleteModal('customers')}
                  className="border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Delete Inactive Customers
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => openDeleteModal('suppliers')}
                  className="border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Delete Inactive Suppliers
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

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
              variant="secondary"
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
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setConfirmText('');
          setDeleteType(null);
        }}
        title={`Permanently Delete Inactive ${deleteType === 'products' ? 'Products' : deleteType === 'customers' ? 'Customers' : 'Suppliers'}`}
      >
        <div className="space-y-4">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <div className="flex gap-3">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">
                  This will permanently delete all inactive {deleteType}
                </h3>
                <p className="text-sm text-red-700">
                  {deleteType === 'products'
                    ? 'All inactive products and their related data (variants, inventory, stock movements) will be permanently deleted from your database.'
                    : deleteType === 'customers'
                    ? 'Inactive customers without transaction history will be permanently deleted. Customers with sales records cannot be deleted.'
                    : 'Inactive suppliers without transaction history will be permanently deleted. Suppliers with purchase orders cannot be deleted.'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type <span className="font-mono font-bold">DELETE PERMANENTLY</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="DELETE PERMANENTLY"
              autoFocus
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false);
                setConfirmText('');
                setDeleteType(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteInactive}
              disabled={confirmText !== 'DELETE PERMANENTLY' || isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
