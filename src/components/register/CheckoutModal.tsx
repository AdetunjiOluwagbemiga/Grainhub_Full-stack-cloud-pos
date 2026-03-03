import { useState } from 'react';
import { CreditCard, DollarSign, Printer, CheckCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent } from '../ui/Card';
import { useCreateSale, usePaymentMethods } from '../../hooks/useSales';
import { useAuth } from '../../contexts/AuthContext';
import { useActiveShift } from '../../hooks/useShifts';
import { CartItem } from '../../types/database';
import { formatCurrency, generateReceiptHTML, printReceipt } from '../../lib/utils';
import toast from 'react-hot-toast';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  onComplete: () => void;
}

interface PaymentEntry {
  payment_method_id: string;
  amount: number;
  reference_number?: string;
}

export function CheckoutModal({
  isOpen,
  onClose,
  cart,
  subtotal,
  discount,
  tax,
  total,
  onComplete,
}: CheckoutModalProps) {
  const { profile } = useAuth();
  const { data: paymentMethods } = usePaymentMethods();
  const { data: activeShift } = useActiveShift();
  const createSale = useCreateSale();

  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [reference, setReference] = useState('');
  const [processing, setProcessing] = useState(false);
  const [saleCompleted, setSaleCompleted] = useState(false);
  const [completedSaleData, setCompletedSaleData] = useState<any>(null);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - totalPaid;
  const change = totalPaid > total ? totalPaid - total : 0;

  const addPayment = () => {
    if (!selectedMethod || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Please select a payment method and enter an amount');
      return;
    }

    const amount = parseFloat(paymentAmount);

    setPayments([
      ...payments,
      {
        payment_method_id: selectedMethod,
        amount,
        reference_number: reference || undefined,
      },
    ]);

    setPaymentAmount('');
    setReference('');
    setSelectedMethod('');
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handlePrintReceipt = () => {
    if (!completedSaleData) return;

    try {
      const receiptHTML = generateReceiptHTML(
        {
          sale_number: completedSaleData.sale_number,
          created_at: completedSaleData.created_at,
          subtotal: completedSaleData.subtotal,
          discount_amount: completedSaleData.discount_amount,
          tax_amount: completedSaleData.tax_amount,
          total_amount: completedSaleData.total_amount,
          amount_paid: completedSaleData.amount_paid,
          change_amount: completedSaleData.change_amount,
        },
        cart.map(item => ({
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
        })),
        'Cloud POS System',
        '123 Main Street'
      );

      printReceipt(receiptHTML);
      toast.success('Receipt sent to printer');
    } catch (printError) {
      console.error('Print failed:', printError);
      toast.error('Failed to print receipt. You can reprint from Sales History.');
    }
  };

  const handleCloseAndFinish = () => {
    onComplete();
    setSaleCompleted(false);
    setCompletedSaleData(null);
  };

  const handleCompleteSale = async () => {
    if (totalPaid < total) {
      toast.error('Please complete payment before finalizing sale');
      return;
    }

    if (!profile) {
      toast.error('User profile not loaded');
      return;
    }

    // TEMPORARILY DISABLED FOR TESTING - SHIFT REQUIREMENT
    // if (!activeShift) {
    //   toast.error('No active shift. Please open a shift before processing sales.');
    //   return;
    // }

    setProcessing(true);

    try {
      const defaultLocationId = 'eb23cc18-3aa6-4a73-9115-ed493974c5fa';

      const saleData = await createSale.mutateAsync({
        sale: {
          location_id: defaultLocationId,
          customer_id: null,
          cashier_id: profile.id,
          shift_id: activeShift?.id || null, // Allow null for testing
          status: 'completed',
          subtotal,
          discount_amount: discount,
          discount_percentage: 0,
          tax_amount: tax,
          total_amount: total,
          amount_paid: totalPaid,
          change_amount: change,
          loyalty_points_earned: 0,
          loyalty_points_redeemed: 0,
          notes: null,
          voided_by: null,
          voided_at: null,
          void_reason: null,
          completed_at: new Date().toISOString(),
        },
        items: cart,
        payments,
        locationId: defaultLocationId,
      });

      setCompletedSaleData(saleData);
      setSaleCompleted(true);
      toast.success('Payment completed successfully!');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to complete sale');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Checkout" size="lg">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>

          <div className="space-y-2 mb-4">
            {cart.map((item, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {item.quantity}x {item.product_name}
                </span>
                <span className="text-gray-900">{formatCurrency(item.line_total)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>Tax</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Payment</h3>

          <Card className="mb-4">
            <CardContent className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={selectedMethod}
                  onChange={(e) => setSelectedMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select method</option>
                  {paymentMethods?.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                type="number"
                label="Amount"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                step="0.01"
              />

              <Input
                type="text"
                label="Reference (optional)"
                placeholder="Transaction ID, Check #, etc."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />

              <Button
                className="w-full"
                onClick={addPayment}
                disabled={!selectedMethod || !paymentAmount}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Add Payment
              </Button>
            </CardContent>
          </Card>

          {payments.length > 0 && (
            <div className="mb-4 space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Payments Added</h4>
              {payments.map((payment, index) => {
                const method = paymentMethods?.find(m => m.id === payment.payment_method_id);
                return (
                  <Card key={index}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{method?.name}</div>
                        <div className="text-sm text-gray-500">
                          {formatCurrency(payment.amount)}
                        </div>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => removePayment(index)}
                      >
                        Remove
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="bg-blue-50 rounded-lg p-4 mb-4 space-y-2">
            <div className="flex justify-between text-gray-700">
              <span>Total</span>
              <span className="font-semibold">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Paid</span>
              <span className="font-semibold">{formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-blue-600 pt-2 border-t border-blue-200">
              <span>{remaining > 0 ? 'Remaining' : 'Change'}</span>
              <span>{formatCurrency(remaining > 0 ? remaining : change)}</span>
            </div>
          </div>

          {!saleCompleted ? (
            <Button
              className="w-full"
              size="lg"
              variant="success"
              onClick={handleCompleteSale}
              disabled={totalPaid < total || processing || payments.length === 0}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              {processing ? 'Processing...' : 'Complete Payment'}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-green-600 mb-2" />
                <h4 className="text-lg font-semibold text-green-900">Payment Completed!</h4>
                <p className="text-sm text-green-700 mt-1">
                  Sale #{completedSaleData?.sale_number}
                </p>
                {change > 0 && (
                  <p className="text-lg font-bold text-green-900 mt-2">
                    Change Due: {formatCurrency(change)}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handlePrintReceipt}
                >
                  <Printer className="w-5 h-5 mr-2" />
                  Print Receipt
                </Button>

                <Button
                  variant="success"
                  size="lg"
                  onClick={handleCloseAndFinish}
                >
                  Finish
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
