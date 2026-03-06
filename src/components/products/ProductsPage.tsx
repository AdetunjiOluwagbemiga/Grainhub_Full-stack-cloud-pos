import { useState, useRef } from 'react';
import { Plus, Search, CreditCard as Edit, Trash2, Barcode as BarcodeIcon, Download, Upload, FileDown } from 'lucide-react';
import { useProducts, useCreateProduct, useUpdateProduct, useGenerateBarcode, useDeleteProducts } from '../../hooks/useProducts';
import { useCategories } from '../../hooks/useCategories';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { formatCurrency } from '../../lib/utils';
import { exportProductsToExcel, importProductsFromExcel, downloadExcelTemplate } from '../../lib/excelUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export function ProductsPage() {
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const generateBarcode = useGenerateBarcode();
  const deleteProducts = useDeleteProducts();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    barcode: '',
    cost_price: '',
    retail_price: '',
    margin_percent: '',
    tax_rate: '15',
    unit_of_measure: 'piece',
    category_id: '',
    is_weighed: false,
    is_quick_sale: false,
    initial_quantity: '',
  });

  const filteredProducts = products?.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async () => {
    try {
      const productData = {
        ...formData,
        cost_price: parseFloat(formData.cost_price),
        retail_price: parseFloat(formData.retail_price),
        margin_percent: formData.margin_percent ? parseFloat(formData.margin_percent) : 0,
        tax_rate: parseFloat(formData.tax_rate),
        category_id: formData.category_id || null,
        barcode: formData.barcode || null,
        has_variants: false,
        track_inventory: true,
        is_active: true,
        image_url: null,
        created_by: null,
      };

      if (editingProduct) {
        await updateProduct.mutateAsync({
          id: editingProduct.id,
          updates: productData,
        });
      } else {
        const initialQuantity = formData.initial_quantity ? parseFloat(formData.initial_quantity) : 0;
        await createProduct.mutateAsync({ productData, initialQuantity });
      }
      setCreateModalOpen(false);
      setEditingProduct(null);
      resetForm();
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      sku: '',
      name: '',
      description: '',
      barcode: '',
      cost_price: '',
      retail_price: '',
      margin_percent: '',
      tax_rate: '15',
      unit_of_measure: 'piece',
      category_id: '',
      is_weighed: false,
      is_quick_sale: false,
      initial_quantity: '',
    });
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      barcode: product.barcode || '',
      cost_price: product.cost_price.toString(),
      retail_price: product.retail_price.toString(),
      margin_percent: product.margin_percent?.toString() || '',
      tax_rate: product.tax_rate.toString(),
      unit_of_measure: product.unit_of_measure,
      category_id: product.category_id || '',
      is_weighed: product.is_weighed || false,
      is_quick_sale: product.is_quick_sale || false,
    });
    setCreateModalOpen(true);
  };

  const handleGenerateBarcode = async (productId: string) => {
    try {
      await generateBarcode.mutateAsync(productId);
    } catch (error) {
      console.error('Error generating barcode:', error);
    }
  };

  const handleExport = () => {
    if (!products || products.length === 0) {
      toast.error('No products to export');
      return;
    }
    exportProductsToExcel(products);
    toast.success('Products exported successfully!');
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
    const toastId = toast.loading('Importing products...');

    try {
      const result = await importProductsFromExcel(file, user?.id || null);

      await queryClient.invalidateQueries({ queryKey: ['products'] });

      if (result.errors.length > 0) {
        toast.error(
          `Imported ${result.success} products with ${result.errors.length} errors. Check console for details.`,
          { id: toastId, duration: 5000 }
        );
        console.error('Import errors:', result.errors);
      } else {
        toast.success(`Successfully imported ${result.success} products!`, { id: toastId });
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to import products', { id: toastId });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate();
    toast.success('Template downloaded!');
  };

  const toggleSelectProduct = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProducts.length === filteredProducts?.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts?.map(p => p.id) || []);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedProducts.length === 0) {
      toast.error('No products selected');
      return;
    }

    try {
      await deleteProducts.mutateAsync(selectedProducts);
      setSelectedProducts([]);
      setDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting products:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Products</h1>
            {selectedProducts.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedProducts.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => setDeleteModalOpen(true)}
                size="sm"
                className="flex-1 sm:flex-none bg-red-50 text-red-600 hover:bg-red-100"
              >
                <Trash2 className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Delete Selected ({selectedProducts.length})</span>
                <span className="sm:hidden">Delete ({selectedProducts.length})</span>
              </Button>
            )}
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
            <Button onClick={() => {
              resetForm();
              setEditingProduct(null);
              setCreateModalOpen(true);
            }} className="flex-1 sm:flex-none">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="sm:inline">Add Product</span>
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

      <div className="p-4 sm:p-6">
        <Card className="mb-4 sm:mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {filteredProducts && filteredProducts.length > 0 && (
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedProducts.length === filteredProducts.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </label>
              )}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4">
          {filteredProducts?.map((product) => (
            <Card key={product.id}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start gap-3">
                  <label className="flex items-center cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.id)}
                      onChange={() => toggleSelectProduct(product.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">{product.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">SKU: {product.sku}</p>
                    {product.description && (
                      <p className="text-sm text-gray-600 mt-2">{product.description}</p>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-4">
                      <div>
                        <span className="text-xs text-gray-500">Cost Price</span>
                        <p className="font-medium text-gray-900">{formatCurrency(product.cost_price)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Retail Price</span>
                        <p className="font-medium text-gray-900">{formatCurrency(product.retail_price)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Margin</span>
                        <p className="font-medium text-green-600">{product.margin_percentage?.toFixed(2)}%</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Tax Rate</span>
                        <p className="font-medium text-gray-900">{product.tax_rate}%</p>
                      </div>
                    </div>

                    {product.barcodes && product.barcodes.length > 0 && (
                      <div className="mt-3">
                        <span className="text-xs text-gray-500">Barcodes: </span>
                        <span className="text-sm text-gray-900">
                          {product.barcodes.map(b => b.barcode).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleGenerateBarcode(product.id)}
                    >
                      <BarcodeIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEdit(product)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredProducts?.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-600">No products found</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setEditingProduct(null);
          resetForm();
        }}
        title={editingProduct ? 'Edit Product' : 'Create New Product'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="SKU"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              required
            />
            <Input
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Barcode (optional)"
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              placeholder="Enter or scan barcode"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Category</option>
                {categories?.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Cost Price"
              type="number"
              step="0.01"
              value={formData.cost_price}
              onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
              required
            />
            <Input
              label="Retail Price"
              type="number"
              step="0.01"
              value={formData.retail_price}
              onChange={(e) => setFormData({ ...formData, retail_price: e.target.value })}
              required
            />
            <Input
              label="Margin %"
              type="number"
              step="0.01"
              value={formData.margin_percent}
              onChange={(e) => setFormData({ ...formData, margin_percent: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Tax Rate (%)"
              type="number"
              step="0.01"
              value={formData.tax_rate}
              onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit of Measure
              </label>
              <select
                value={formData.unit_of_measure}
                onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="piece">Piece</option>
                <option value="kg">Kilogram</option>
                <option value="liter">Liter</option>
                <option value="meter">Meter</option>
              </select>
            </div>
          </div>

          {!editingProduct && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <Input
                label="Initial Quantity (optional)"
                type="number"
                step="0.01"
                min="0"
                value={formData.initial_quantity}
                onChange={(e) => setFormData({ ...formData, initial_quantity: e.target.value })}
                placeholder="0"
              />
              <p className="text-xs text-gray-600 mt-1">
                Set the starting inventory quantity for this product
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_weighed}
                onChange={(e) => setFormData({ ...formData, is_weighed: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Weight-based Product</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_quick_sale}
                onChange={(e) => setFormData({ ...formData, is_quick_sale: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Quick Sale Item</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={!formData.sku || !formData.name || !formData.retail_price}
            >
              {editingProduct ? 'Update Product' : 'Create Product'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setCreateModalOpen(false);
                setEditingProduct(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Products"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              Are you sure you want to delete {selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''}?
              This will mark them as inactive and they will no longer appear in the system.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={handleDeleteSelected}
              disabled={deleteProducts.isPending}
            >
              {deleteProducts.isPending ? 'Deleting...' : 'Delete Products'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleteProducts.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
