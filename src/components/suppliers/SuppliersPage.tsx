import { useState } from 'react';
import { Plus, Edit2, Trash2, Phone, Mail, MapPin, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier, SupplierFormData } from '../../hooks/useSuppliers';

export function SuppliersPage() {
  const { data: suppliers, isLoading } = useSuppliers();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [formData, setFormData] = useState<SupplierFormData>({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    tax_id: '',
    notes: '',
    is_active: true,
  });

  const handleOpenModal = (supplier?: any) => {
    if (supplier) {
      setEditingSupplier(supplier.id);
      setFormData({
        name: supplier.name,
        contact_person: supplier.contact_person || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        tax_id: supplier.tax_id || '',
        notes: supplier.notes || '',
        is_active: supplier.is_active,
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        tax_id: '',
        notes: '',
        is_active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingSupplier) {
      updateSupplier.mutate(
        { id: editingSupplier, data: formData },
        { onSuccess: handleCloseModal }
      );
    } else {
      createSupplier.mutate(formData, { onSuccess: handleCloseModal });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this supplier?')) {
      deleteSupplier.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">Loading suppliers...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-gray-600 mt-1">Manage your vendors and suppliers</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      {!suppliers || suppliers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <p>No suppliers yet. Add your first supplier to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((supplier) => (
            <Card key={supplier.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{supplier.name}</h3>
                    {supplier.contact_person && (
                      <p className="text-sm text-gray-600 mt-1">{supplier.contact_person}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {supplier.is_active ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  {supplier.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4" />
                      <span>{supplier.phone}</span>
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span>{supplier.email}</span>
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mt-0.5" />
                      <span className="flex-1">{supplier.address}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-3 border-t border-gray-200">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenModal(supplier)}
                    className="flex-1"
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(supplier.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Supplier Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Input
            label="Contact Person"
            value={formData.contact_person}
            onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />

            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <Input
            label="Tax ID"
            value={formData.tax_id}
            onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Active supplier
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseModal}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createSupplier.isPending || updateSupplier.isPending}
              className="flex-1"
            >
              {editingSupplier ? 'Update' : 'Create'} Supplier
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
