import { useState, useMemo } from 'react';
import { DollarSign, TrendingUp, Package, AlertTriangle, Download, Filter, Search } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useInventoryValuation, useValuationSummary, useCategoryValuationBreakdown } from '../../hooks/useValuation';
import { useCategories } from '../../hooks/useCategories';
import { formatCurrency } from '../../lib/utils';
import { exportValuationToExcel } from '../../lib/excelUtils';

export function ValuationDashboard() {
  const { data: valuationData, isLoading } = useInventoryValuation();
  const { data: categories } = useCategories();
  const { data: categoryBreakdown } = useCategoryValuationBreakdown();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowMargin, setShowLowMargin] = useState(false);
  const [showNeedsCosting, setShowNeedsCosting] = useState(false);

  const { data: summary } = useValuationSummary(selectedCategory, true);

  const filteredData = useMemo(() => {
    if (!valuationData) return [];

    return valuationData.filter(item => {
      if (selectedCategory && item.category_id !== selectedCategory) return false;

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!item.product_name.toLowerCase().includes(search) &&
            !item.sku.toLowerCase().includes(search)) {
          return false;
        }
      }

      if (showLowMargin && item.margin_percentage >= 10) return false;
      if (showNeedsCosting && !item.needs_costing) return false;

      return true;
    });
  }, [valuationData, selectedCategory, searchTerm, showLowMargin, showNeedsCosting]);

  const handleExportExcel = () => {
    if (!valuationData || !summary) return;
    exportValuationToExcel(valuationData, summary);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">Loading valuation data...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Valuation</h1>
          <p className="text-gray-600 mt-1">Financial overview of stock assets and profit potential</p>
        </div>
        <Button onClick={handleExportExcel}>
          <Download className="w-4 h-4 mr-2" />
          Download Report
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(summary?.total_cost_value || 0)}
            </div>
            <p className="text-sm text-gray-600 mt-1">Total Assets (Cost)</p>
            <p className="text-xs text-gray-500 mt-1">
              {summary?.total_products || 0} products · {summary?.total_stock || 0} units
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(summary?.total_retail_value || 0)}
            </div>
            <p className="text-sm text-gray-600 mt-1">Revenue Potential</p>
            <p className="text-xs text-gray-500 mt-1">If all stock sold at retail</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(summary?.total_potential_profit || 0)}
            </div>
            <p className="text-sm text-gray-600 mt-1">Projected Gross Profit</p>
            <p className="text-xs text-gray-500 mt-1">
              Avg. Margin: {summary?.average_margin_percentage?.toFixed(1) || 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {summary?.products_needing_costing || 0}
            </div>
            <p className="text-sm text-gray-600 mt-1">Needs Costing</p>
            <p className="text-xs text-gray-500 mt-1">
              {summary?.low_margin_products || 0} low margin items
            </p>
          </CardContent>
        </Card>
      </div>

      {categoryBreakdown && categoryBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Category Breakdown</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryBreakdown.map((cat) => (
                <div
                  key={cat.category_id || 'uncategorized'}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 cursor-pointer transition-colors"
                  onClick={() => setSelectedCategory(
                    selectedCategory === cat.category_id ? null : cat.category_id
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{cat.category_name}</h3>
                    {selectedCategory === cat.category_id && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        Selected
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Assets:</span>
                      <span className="font-medium">{formatCurrency(cat.total_cost_value)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Potential:</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(cat.potential_profit)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Products:</span>
                      <span className="font-medium">{cat.product_count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <h2 className="text-lg font-semibold">Product Valuation Details</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={showLowMargin ? 'default' : 'outline'}
                onClick={() => setShowLowMargin(!showLowMargin)}
              >
                <Filter className="w-4 h-4 mr-1" />
                Low Margin ({summary?.low_margin_products || 0})
              </Button>
              <Button
                size="sm"
                variant={showNeedsCosting ? 'default' : 'outline'}
                onClick={() => setShowNeedsCosting(!showNeedsCosting)}
              >
                <AlertTriangle className="w-4 h-4 mr-1" />
                Needs Costing ({summary?.products_needing_costing || 0})
              </Button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories?.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Product</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Stock</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Cost</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Retail</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Asset Value</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Retail Value</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Potential Profit</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No products match your filters
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => (
                    <tr
                      key={item.product_id}
                      className={
                        item.has_negative_stock
                          ? 'bg-red-50'
                          : item.needs_costing
                          ? 'bg-amber-50'
                          : ''
                      }
                    >
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900">{item.product_name}</div>
                          <div className="text-xs text-gray-500">
                            {item.sku}
                            {item.category_name && ` · ${item.category_name}`}
                          </div>
                          {item.needs_costing && (
                            <span className="inline-block mt-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                              Needs Costing
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={item.has_negative_stock ? 'text-red-600 font-medium' : ''}>
                          {item.stock_quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.cost_price)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.retail_price)}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(item.total_cost_value)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(item.total_retail_value)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">
                        {formatCurrency(item.potential_profit)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            item.margin_percentage < 10
                              ? 'text-red-600 font-medium'
                              : item.margin_percentage < 20
                              ? 'text-amber-600'
                              : 'text-green-600'
                          }
                        >
                          {item.margin_percentage.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredData.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr className="font-semibold">
                    <td className="px-4 py-3" colSpan={4}>
                      Totals ({filteredData.length} products)
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(
                        filteredData.reduce((sum, item) => sum + item.total_cost_value, 0)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(
                        filteredData.reduce((sum, item) => sum + item.total_retail_value, 0)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600">
                      {formatCurrency(
                        filteredData.reduce((sum, item) => sum + item.potential_profit, 0)
                      )}
                    </td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
