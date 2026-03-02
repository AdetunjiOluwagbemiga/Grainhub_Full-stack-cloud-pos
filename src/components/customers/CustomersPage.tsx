import { useState, useRef } from 'react';
import { Users, Plus, Search, Star, Download, Upload, FileDown } from 'lucide-react';
import { useCustomers, useCreateCustomer, useUpdateCustomer } from '../../hooks/useCustomers';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { formatCurrency } from '../../lib/utils';
import { exportCustomersToExcel, importCustomersFromExcel, downloadCustomerTemplate } from '../../lib/excelUtils';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export function CustomersPage() {
  const { data: customers, isLoading } = useCustomers();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [formData, setFormData] = useState({
    customer_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });

  const filteredCustomers = customers?.filter(c =>
    c.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  const handleSubmit = async () => {
    try {
      await createCustomer.mutateAsync({
        ...formData,
        customer_code: formData.customer_code || `CUST-${Date.now()}`,
        email: formData.email || null,
        phone: formData.phone || null,
        loyalty_points: 0,
        total_spent: 0,
        visit_count: 0,
        last_visit_at: null,
        date_of_birth: null,
        notes: null,
        is_active: true,
      });

      setCreateModalOpen(false);
      setFormData({
        customer_code: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
      });
    } catch (error) {
      console.error('Error creating customer:', error);
    }
  };

  const handleExport = () => {
    if (!customers || customers.length === 0) {
      toast.error('No customers to export');
      return;
    }
    exportCustomersToExcel(customers);
    toast.success('Customers exported successfully!');
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

    setImporting(true);
    const toastId = toast.loading('Importing customers...');

    try {
      const result = await importCustomersFromExcel(file);

      await queryClient.invalidateQueries({ queryKey: ['customers'] });

      if (result.errors.length > 0) {
        toast.error(
          `Imported ${result.success} customers with ${result.errors.length} errors. Check console for details.`,
          { id: toastId, duration: 5000 }
        );
        console.error('Import errors:', result.errors);
      } else {
        toast.success(`Successfully imported ${result.success} customers!`, { id: toastId });
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to import customers', { id: toastId });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = () => {
    downloadCustomerTemplate();
    toast.success('Template downloaded!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">Loading customers...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Customers</h1>
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
            <Button onClick={() => setCreateModalOpen(true)} className="flex-1 sm:flex-none">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="sm:inline">Add Customer</span>
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

      <div className="p-6">
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCustomers?.map((customer) => (
            <Card key={customer.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {customer.first_name} {customer.last_name}
                      </h3>
                      <p className="text-sm text-gray-600">Code: {customer.customer_code}</p>
                      {customer.email && (
                        <p className="text-sm text-gray-600">{customer.email}</p>
                      )}
                      {customer.phone && (
                        <p className="text-sm text-gray-600">{customer.phone}</p>
                      )}

                      <div className="flex gap-4 mt-3">
                        <div>
                          <span className="text-xs text-gray-500">Loyalty Points</span>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500" />
                            <span className="font-semibold text-gray-900">
                              {customer.loyalty_points}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Total Spent</span>
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(customer.total_spent)}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Visits</span>
                          <p className="font-semibold text-gray-900">{customer.visit_count}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredCustomers?.length === 0 && (
            <Card className="col-span-2">
              <CardContent className="py-12 text-center">
                <p className="text-gray-600">No customers found</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add New Customer"
      >
        <div className="space-y-4">
          <Input
            label="Customer Code (optional)"
            value={formData.customer_code}
            onChange={(e) => setFormData({ ...formData, customer_code: e.target.value })}
            placeholder="Auto-generated if left empty"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
            />
            <Input
              label="Last Name"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              required
            />
          </div>

          <Input
            label="Email (optional)"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />

          <Input
            label="Phone (optional)"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />

          <div className="flex gap-3 pt-4">
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={!formData.first_name || !formData.last_name}
            >
              Create Customer
            </Button>
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
