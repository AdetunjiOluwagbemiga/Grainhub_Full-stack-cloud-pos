import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Store, CreditCard, Receipt, Save, CreditCard as Edit2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { useSettings, useUpdateSetting } from '../../hooks/useSettings';
import { CURRENCY_OPTIONS, CurrencyCode } from '../../lib/currency';
import toast from 'react-hot-toast';

export function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSetting = useUpdateSetting();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    store_name: '',
    store_address: '',
    store_phone: '',
    store_email: '',
    currency: 'NGN' as CurrencyCode,
    tax_rate: 0,
    tax_inclusive: false,
    receipt_header: '',
    receipt_footer: '',
    auto_print_receipt: true,
    date_format: 'DD/MM/YYYY',
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        store_name: settings.store_name || '',
        store_address: settings.store_address || '',
        store_phone: settings.store_phone || '',
        store_email: settings.store_email || '',
        currency: settings.currency || 'NGN',
        tax_rate: settings.tax_rate || 0,
        tax_inclusive: settings.tax_inclusive || false,
        receipt_header: settings.receipt_header || '',
        receipt_footer: settings.receipt_footer || '',
        auto_print_receipt: settings.auto_print_receipt ?? true,
        date_format: settings.date_format || 'DD/MM/YYYY',
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      const updates = Object.entries(formData).map(([key, value]) =>
        updateSetting.mutateAsync({ key, value })
      );

      await Promise.all(updates);

      const selectedCurrency = CURRENCY_OPTIONS.find(c => c.code === formData.currency);
      if (selectedCurrency) {
        await updateSetting.mutateAsync({
          key: 'currency_symbol',
          value: selectedCurrency.symbol
        });
      }

      toast.success('Settings saved successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-600">Loading settings...</div>
      </div>
    );
  }
  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Settings</h1>
        <div className="flex gap-2">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} variant="primary">
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          ) : (
            <>
              <Button onClick={() => setIsEditing(false)} variant="secondary">
                Cancel
              </Button>
              <Button onClick={handleSave} variant="primary">
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 flex-1 overflow-auto">
        <div className="max-w-4xl space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Store className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Store Information</h2>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Store Name
                  </label>
                  <input
                    type="text"
                    value={formData.store_name}
                    onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={formData.store_address}
                    onChange={(e) => setFormData({ ...formData, store_address: e.target.value })}
                    disabled={!isEditing}
                    placeholder="123 Main Street"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.store_phone}
                      onChange={(e) => setFormData({ ...formData, store_phone: e.target.value })}
                      disabled={!isEditing}
                      placeholder="(555) 123-4567"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.store_email}
                      onChange={(e) => setFormData({ ...formData, store_email: e.target.value })}
                      disabled={!isEditing}
                      placeholder="store@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Tax Configuration</h2>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    value={formData.tax_rate}
                    onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                    disabled={!isEditing}
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="tax-inclusive"
                    checked={formData.tax_inclusive}
                    onChange={(e) => setFormData({ ...formData, tax_inclusive: e.target.checked })}
                    disabled={!isEditing}
                    className="rounded disabled:opacity-50"
                  />
                  <label htmlFor="tax-inclusive" className="text-sm text-gray-700">
                    Tax Inclusive Pricing
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Receipt Settings</h2>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Receipt Header Message
                  </label>
                  <textarea
                    value={formData.receipt_header}
                    onChange={(e) => setFormData({ ...formData, receipt_header: e.target.value })}
                    disabled={!isEditing}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Receipt Footer Message
                  </label>
                  <textarea
                    value={formData.receipt_footer}
                    onChange={(e) => setFormData({ ...formData, receipt_footer: e.target.value })}
                    disabled={!isEditing}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto-print"
                    checked={formData.auto_print_receipt}
                    onChange={(e) => setFormData({ ...formData, auto_print_receipt: e.target.checked })}
                    disabled={!isEditing}
                    className="rounded disabled:opacity-50"
                  />
                  <label htmlFor="auto-print" className="text-sm text-gray-700">
                    Automatically print receipt after sale
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <SettingsIcon className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">System Preferences</h2>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value as CurrencyCode })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
                  >
                    {CURRENCY_OPTIONS.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name} ({currency.symbol})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date Format
                  </label>
                  <select
                    value={formData.date_format}
                    onChange={(e) => setFormData({ ...formData, date_format: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
