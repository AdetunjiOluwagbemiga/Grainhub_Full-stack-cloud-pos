import { useState, useEffect, useRef } from 'react';
import { Scan, ShoppingCart, Trash2, Plus, Minus, Tag, User, Search, Edit2 } from 'lucide-react';
import { useProducts, useProductByBarcode } from '../../hooks/useProducts';
import { usePaymentMethods } from '../../hooks/useSales';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { CartItem } from '../../types/database';
import { formatCurrency, calculateLineTotal } from '../../lib/utils';
import { CheckoutModal } from './CheckoutModal';
import toast from 'react-hot-toast';

export function Register() {
  const [barcode, setBarcode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showBarcodeResults, setShowBarcodeResults] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeDropdownRef = useRef<HTMLDivElement>(null);

  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: scannedProduct } = useProductByBarcode(barcode);
  const { data: paymentMethods } = usePaymentMethods();

  const quickSaleProducts = products?.filter(p => p.is_quick_sale) || [];

  const searchResults = products?.filter(p =>
    searchTerm.length > 0 && (
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcodes?.some(b => b.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  ).slice(0, 10) || [];

  const barcodeResults = products?.filter(p =>
    barcode.length > 0 && (
      p.name.toLowerCase().includes(barcode.toLowerCase()) ||
      p.sku.toLowerCase().includes(barcode.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(barcode.toLowerCase()) ||
      p.barcodes?.some(b => b.barcode.toLowerCase().includes(barcode.toLowerCase()))
    )
  ).slice(0, 10) || [];

  useEffect(() => {
    const handleGlobalBarcode = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement &&
        e.target !== barcodeInputRef.current
      ) {
        return;
      }

      if (e.key === 'Enter' && barcode) {
        handleBarcodeSubmit();
      }
    };

    window.addEventListener('keydown', handleGlobalBarcode);
    return () => window.removeEventListener('keydown', handleGlobalBarcode);
  }, [barcode]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        const searchDropdown = searchInputRef.current.parentElement?.querySelector('[data-search-dropdown]');
        if (!searchDropdown?.contains(e.target as Node)) {
          setShowSearchResults(false);
        }
      }
      if (barcodeInputRef.current && !barcodeInputRef.current.contains(e.target as Node)) {
        const barcodeDropdown = barcodeDropdownRef.current;
        if (barcodeDropdown && !barcodeDropdown.contains(e.target as Node)) {
          setShowBarcodeResults(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (scannedProduct) {
      addToCart(scannedProduct);
      setBarcode('');
    }
  }, [scannedProduct]);

  const handleBarcodeSubmit = () => {
    if (!barcode.trim()) {
      toast.error('Please enter a barcode or SKU');
      return;
    }

    if (!products || products.length === 0) {
      toast.error('No products available');
      return;
    }

    const searchValue = barcode.trim().toLowerCase();
    const product = products.find(p =>
      p.sku.toLowerCase() === searchValue ||
      p.barcode?.toLowerCase() === searchValue ||
      p.barcodes?.some(b => b.barcode.toLowerCase() === searchValue)
    );

    if (product) {
      addToCart(product);
      setBarcode('');
    } else {
      toast.error(`No product found with barcode/SKU: ${barcode}`);
      setBarcode('');
    }
  };

  const addToCart = (product: any) => {
    const existingIndex = cart.findIndex(
      item => item.sku === product.sku
    );

    if (existingIndex >= 0) {
      updateQuantity(existingIndex, cart[existingIndex].quantity + 1);
    } else {
      const lineCalc = calculateLineTotal(
        1,
        product.retail_price,
        0,
        0,
        product.tax_rate || 0
      );

      const newItem: CartItem = {
        product_id: product.id,
        variant_id: null,
        product_name: product.name,
        sku: product.sku,
        quantity: 1,
        unit_price: product.retail_price,
        cost_price: product.cost_price,
        tax_rate: product.tax_rate || 0,
        discount_percentage: 0,
        discount_amount: 0,
        line_total: lineCalc.total,
        tax_amount: lineCalc.tax,
      };

      setCart([...cart, newItem]);
      toast.success(`Added ${product.name} to cart`);
    }

    setBarcode('');
    setSearchTerm('');
    setShowBarcodeResults(false);
    setShowSearchResults(false);
    barcodeInputRef.current?.focus();
  };

  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(index);
      return;
    }

    const item = cart[index];
    const lineCalc = calculateLineTotal(
      newQuantity,
      item.unit_price,
      item.discount_percentage,
      item.discount_amount,
      item.tax_rate
    );

    const updatedCart = [...cart];
    updatedCart[index] = {
      ...item,
      quantity: newQuantity,
      line_total: lineCalc.total,
      tax_amount: lineCalc.tax,
    };
    setCart(updatedCart);
  };

  const updateDiscount = (index: number, discountPercentage: number) => {
    const item = cart[index];
    const lineCalc = calculateLineTotal(
      item.quantity,
      item.unit_price,
      discountPercentage,
      0,
      item.tax_rate
    );

    const updatedCart = [...cart];
    updatedCart[index] = {
      ...item,
      discount_percentage: discountPercentage,
      discount_amount: lineCalc.discount,
      line_total: lineCalc.total,
      tax_amount: lineCalc.tax,
    };
    setCart(updatedCart);
  };

  const removeFromCart = (index: number) => {
    const item = cart[index];
    const updatedCart = cart.filter((_, i) => i !== index);
    setCart(updatedCart);
    toast.success(`Removed ${item.product_name} from cart`, {
      duration: 4000,
    });
  };

  const clearCart = () => {
    if (cart.length === 0) return;

    if (window.confirm('Are you sure you want to clear the entire cart?')) {
      setCart([]);
      setSelectedCustomer(null);
      toast.success('Cart cleared');
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const totalDiscount = cart.reduce((sum, item) => sum + item.discount_amount, 0);
  const totalTax = cart.reduce((sum, item) => sum + item.tax_amount, 0);
  const total = cart.reduce((sum, item) => sum + item.line_total, 0);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Point of Sale</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="secondary" size="sm" className="hidden sm:flex">
              <User className="w-4 h-4 mr-2" />
              {selectedCustomer ? 'Customer Selected' : 'Select Customer'}
            </Button>
            <Button variant="secondary" size="sm" className="sm:hidden">
              <User className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 p-4 sm:p-6 overflow-auto">
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex gap-2 mb-3">
                <div className="flex-1 relative">
                  <Scan className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="Scan barcode or enter SKU..."
                    value={barcode}
                    onChange={(e) => {
                      setBarcode(e.target.value);
                      setShowBarcodeResults(e.target.value.length > 0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (barcodeResults.length === 1) {
                          addToCart(barcodeResults[0]);
                        } else if (barcodeResults.length > 1) {
                          setShowBarcodeResults(true);
                        } else {
                          handleBarcodeSubmit();
                        }
                      }
                    }}
                    onFocus={() => setShowBarcodeResults(barcode.length > 0)}
                    className="pl-10"
                    autoFocus
                  />

                  {showBarcodeResults && barcodeResults.length > 0 && (
                    <div
                      ref={barcodeDropdownRef}
                      className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
                    >
                      {barcodeResults.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => addToCart(product)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 focus:outline-none focus:bg-gray-50"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{product.name}</p>
                              <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-gray-900">
                                {formatCurrency(product.retail_price)}
                              </p>
                              <p className="text-xs text-gray-500">
                                Stock: {product.current_stock || 0}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleBarcodeSubmit}
                  disabled={productsLoading || !barcode.trim()}
                >
                  {productsLoading ? 'Loading...' : 'Add'}
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search products by name or SKU..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSearchResults(e.target.value.length > 0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (searchResults.length === 1) {
                        addToCart(searchResults[0]);
                      } else if (searchResults.length > 1) {
                        setShowSearchResults(true);
                      }
                    }
                  }}
                  onFocus={() => setShowSearchResults(searchTerm.length > 0)}
                  className="pl-10"
                />

                {showSearchResults && (
                  <div
                    data-search-dropdown
                    className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
                  >
                    {searchResults.length === 0 ? (
                      <div className="px-4 py-3 text-gray-500 text-center">
                        No products found
                      </div>
                    ) : (
                      searchResults.map((product) => (
                      <button
                        key={product.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addToCart(product);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 focus:outline-none focus:bg-gray-50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{product.name}</p>
                            <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              {formatCurrency(product.retail_price)}
                            </p>
                            <p className="text-xs text-gray-500">
                              Stock: {product.current_stock || 0}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {quickSaleProducts.length > 0 && (
            <Card className="mb-4">
              <CardHeader>
                <h3 className="text-sm font-semibold text-gray-700">Quick Sale</h3>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
                  {quickSaleProducts.map((product) => (
                    <Button
                      key={product.id}
                      variant="secondary"
                      size="sm"
                      onClick={() => addToCart(product)}
                      className="h-20 flex flex-col items-center justify-center text-xs"
                    >
                      <Tag className="w-4 h-4 mb-1" />
                      <span className="font-medium truncate w-full text-center px-1">
                        {product.name}
                      </span>
                      <span className="text-gray-600">
                        {formatCurrency(product.retail_price)}
                      </span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {cart.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShoppingCart className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 text-lg">Cart is empty</p>
                <p className="text-gray-500 text-sm mt-2">
                  Scan a barcode or search for products to add to cart
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-blue-800">
                  <strong>Tip:</strong> Click on quantity to edit, use +/- buttons, or click the trash icon to remove items
                </p>
              </div>
              <div className="space-y-2">
                {cart.map((item, index) => (
                <Card key={index}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900">{item.product_name}</h3>
                        <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-2">
                          {editingIndex === index ? (
                            <>
                              <Input
                                type="number"
                                min="1"
                                value={editQuantity}
                                onChange={(e) => setEditQuantity(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const newQty = parseInt(editQuantity);
                                    if (newQty > 0) {
                                      updateQuantity(index, newQty);
                                      setEditingIndex(null);
                                      setEditQuantity('');
                                    }
                                  } else if (e.key === 'Escape') {
                                    setEditingIndex(null);
                                    setEditQuantity('');
                                  }
                                }}
                                className="w-20 text-center"
                                autoFocus
                              />
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  const newQty = parseInt(editQuantity);
                                  if (newQty > 0) {
                                    updateQuantity(index, newQty);
                                    setEditingIndex(null);
                                    setEditQuantity('');
                                  }
                                }}
                              >
                                Save
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingIndex(null);
                                  setEditQuantity('');
                                }}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => updateQuantity(index, item.quantity - 1)}
                              >
                                <Minus className="w-4 h-4" />
                              </Button>
                              <button
                                onClick={() => {
                                  setEditingIndex(index);
                                  setEditQuantity(item.quantity.toString());
                                }}
                                className="w-16 text-center font-medium hover:bg-blue-50 hover:text-blue-600 px-2 py-1 rounded border border-transparent hover:border-blue-300 transition-colors"
                                title="Click to edit quantity"
                              >
                                {item.quantity}
                              </button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => updateQuantity(index, item.quantity + 1)}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>

                        <div className="text-right min-w-[100px]">
                          <div className="font-semibold text-gray-900">
                            {formatCurrency(item.line_total)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatCurrency(item.unit_price)} each
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const discount = prompt('Enter discount percentage:');
                              if (discount !== null) {
                                updateDiscount(index, parseFloat(discount) || 0);
                              }
                            }}
                            title="Add discount"
                          >
                            <Tag className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => removeFromCart(index)}
                            title="Remove from cart"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {item.discount_amount > 0 && (
                      <div className="mt-2 text-sm text-green-600">
                        Discount: -{formatCurrency(item.discount_amount)} ({item.discount_percentage}%)
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              </div>
            </>
          )}
        </div>

        <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col">
          <div className="p-4 sm:p-6 flex-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>

            <div className="space-y-3">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>

              {totalDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(totalDiscount)}</span>
                </div>
              )}

              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>{formatCurrency(totalTax)}</span>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between text-xl font-bold text-gray-900">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Items</span>
                <span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 border-t border-gray-200 space-y-3">
            <Button
              className="w-full"
              size="lg"
              onClick={() => setCheckoutOpen(true)}
              disabled={cart.length === 0}
            >
              Checkout
            </Button>

            <Button
              variant="secondary"
              className="w-full"
              onClick={clearCart}
              disabled={cart.length === 0}
            >
              Clear Cart
            </Button>
          </div>
        </div>
      </div>

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        cart={cart}
        subtotal={subtotal}
        discount={totalDiscount}
        tax={totalTax}
        total={total}
        onComplete={() => {
          clearCart();
          setCheckoutOpen(false);
        }}
      />
    </div>
  );
}
