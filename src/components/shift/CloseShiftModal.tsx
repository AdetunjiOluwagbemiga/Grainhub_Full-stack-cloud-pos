import { useState } from 'react';
import { DollarSign, AlertTriangle, CheckCircle, Printer, TrendingUp, TrendingDown } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCloseShift } from '../../hooks/useShifts';
import { Shift } from '../../hooks/useShifts';
import { useCurrency } from '../../contexts/CurrencyContext';
import { format } from 'date-fns';

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift;
}

export function CloseShiftModal({ isOpen, onClose, shift }: CloseShiftModalProps) {
  const { formatCurrency } = useCurrency();
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [showZReport, setShowZReport] = useState(false);
  const closeShift = useCloseShift();

  const expectedCash = (shift.opening_float || 0) + (shift.total_cash_sales || 0);
  const variance = actualCash ? parseFloat(actualCash) - expectedCash : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cashAmount = parseFloat(actualCash);
    if (isNaN(cashAmount) || cashAmount < 0) {
      return;
    }

    closeShift.mutate(
      {
        shiftId: shift.id,
        closeData: {
          actual_cash: cashAmount,
          notes: notes.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setShowZReport(true);
        },
      }
    );
  };

  const handlePrintZReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const zReportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Z-Report - Shift ${shift.id.slice(0, 8)}</title>
        <style>
          @media print {
            @page { margin: 0; size: 80mm auto; }
          }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: 80mm;
            margin: 0 auto;
            padding: 10mm;
          }
          .header {
            text-align: center;
            border-bottom: 2px dashed #000;
            padding-bottom: 5mm;
            margin-bottom: 5mm;
          }
          .header h1 {
            margin: 0 0 2mm 0;
            font-size: 18px;
          }
          .section {
            margin-bottom: 5mm;
            padding-bottom: 3mm;
            border-bottom: 1px dashed #ccc;
          }
          .row {
            display: flex;
            justify-content: space-between;
            margin: 2mm 0;
          }
          .label {
            flex: 1;
          }
          .value {
            text-align: right;
            font-weight: bold;
          }
          .total {
            font-size: 14px;
            font-weight: bold;
            margin-top: 3mm;
          }
          .variance {
            font-size: 14px;
            font-weight: bold;
            margin: 3mm 0;
          }
          .variance.negative {
            color: #dc2626;
          }
          .variance.positive {
            color: #16a34a;
          }
          .footer {
            text-align: center;
            margin-top: 5mm;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Z-REPORT</h1>
          <div>Shift Closing Summary</div>
          <div>${format(new Date(shift.start_time), 'MMM dd, yyyy hh:mm a')}</div>
          <div>to ${format(new Date(), 'MMM dd, yyyy hh:mm a')}</div>
        </div>

        <div class="section">
          <h3 style="margin: 0 0 3mm 0;">SALES SUMMARY</h3>
          <div class="row">
            <div class="label">Total Transactions:</div>
            <div class="value">${shift.transaction_count}</div>
          </div>
          <div class="row">
            <div class="label">Gross Sales:</div>
            <div class="value">${formatCurrency(shift.total_sales)}</div>
          </div>
          <div class="row">
            <div class="label">Total Discounts:</div>
            <div class="value">-${formatCurrency(shift.total_discounts)}</div>
          </div>
          <div class="row total">
            <div class="label">Net Sales:</div>
            <div class="value">${formatCurrency(shift.total_sales - shift.total_discounts)}</div>
          </div>
        </div>

        <div class="section">
          <h3 style="margin: 0 0 3mm 0;">PAYMENT BREAKDOWN</h3>
          <div class="row">
            <div class="label">Cash Payments:</div>
            <div class="value">${formatCurrency(shift.total_cash_sales)}</div>
          </div>
          <div class="row">
            <div class="label">Card Payments:</div>
            <div class="value">${formatCurrency(shift.total_card_sales)}</div>
          </div>
          <div class="row">
            <div class="label">Tax Collected:</div>
            <div class="value">${formatCurrency(shift.total_tax)}</div>
          </div>
        </div>

        <div class="section">
          <h3 style="margin: 0 0 3mm 0;">CASH RECONCILIATION</h3>
          <div class="row">
            <div class="label">Opening Float:</div>
            <div class="value">${formatCurrency(shift.opening_float)}</div>
          </div>
          <div class="row">
            <div class="label">Cash Sales:</div>
            <div class="value">${formatCurrency(shift.total_cash_sales)}</div>
          </div>
          <div class="row total">
            <div class="label">Expected Cash:</div>
            <div class="value">${formatCurrency(expectedCash)}</div>
          </div>
          <div class="row total">
            <div class="label">Actual Cash:</div>
            <div class="value">${formatCurrency(parseFloat(actualCash))}</div>
          </div>
          <div class="row variance ${variance < 0 ? 'negative' : variance > 0 ? 'positive' : ''}">
            <div class="label">VARIANCE:</div>
            <div class="value">${variance >= 0 ? '+' : ''}${formatCurrency(variance)}</div>
          </div>
        </div>

        ${notes ? `
        <div class="section">
          <h3 style="margin: 0 0 3mm 0;">NOTES</h3>
          <div>${notes}</div>
        </div>
        ` : ''}

        <div class="footer">
          <div>*** END OF REPORT ***</div>
          <div>Shift ID: ${shift.id.slice(0, 8)}</div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(zReportHTML);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleClose = () => {
    setActualCash('');
    setNotes('');
    setShowZReport(false);
    onClose();
  };

  if (showZReport) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Z-Report - Shift Closed">
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <h4 className="font-semibold text-green-900">Shift Closed Successfully</h4>
                <p className="text-sm text-green-700">Your Z-Report is ready</p>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-4 space-y-4">
            <div>
              <h4 className="font-semibold mb-3">Sales Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Transactions:</span>
                  <span className="font-medium">{shift.transaction_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Gross Sales:</span>
                  <span className="font-medium">{formatCurrency(shift.total_sales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Discounts:</span>
                  <span className="font-medium text-red-600">-{formatCurrency(shift.total_discounts)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-semibold">Net Sales:</span>
                  <span className="font-semibold">{formatCurrency(shift.total_sales - shift.total_discounts)}</span>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Payment Breakdown</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Cash Payments:</span>
                  <span className="font-medium">{formatCurrency(shift.total_cash_sales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Card Payments:</span>
                  <span className="font-medium">{formatCurrency(shift.total_card_sales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax Collected:</span>
                  <span className="font-medium">{formatCurrency(shift.total_tax)}</span>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Cash Reconciliation</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Opening Float:</span>
                  <span className="font-medium">{formatCurrency(shift.opening_float)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cash Sales:</span>
                  <span className="font-medium">{formatCurrency(shift.total_cash_sales)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-semibold">Expected Cash:</span>
                  <span className="font-semibold">{formatCurrency(expectedCash)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Actual Cash:</span>
                  <span className="font-semibold">{formatCurrency(parseFloat(actualCash))}</span>
                </div>
              </div>
            </div>

            <div className={`border-t pt-4 ${variance < 0 ? 'bg-red-50 border-red-200' : variance > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50'} -mx-4 -mb-4 px-4 pb-4 mt-4 rounded-b-lg`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {variance < 0 ? (
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  ) : variance > 0 ? (
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-gray-600" />
                  )}
                  <span className={`font-semibold ${variance < 0 ? 'text-red-900' : variance > 0 ? 'text-green-900' : 'text-gray-900'}`}>
                    Variance:
                  </span>
                </div>
                <span className={`text-xl font-bold ${variance < 0 ? 'text-red-600' : variance > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                  {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                </span>
              </div>
              {variance < 0 && (
                <p className="text-xs text-red-700 mt-2">
                  Cash drawer is short. Please verify and document discrepancy.
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Close
            </Button>
            <Button
              onClick={handlePrintZReport}
              className="flex-1 flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print Z-Report
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Close Shift">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-900">Cash Reconciliation Required</h4>
              <p className="text-sm text-amber-700 mt-1">
                Count all physical cash in your drawer and enter the exact amount below.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Opening Float:</span>
            <span className="font-medium">{formatCurrency(shift.opening_float)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Cash Sales:</span>
            <span className="font-medium">{formatCurrency(shift.total_cash_sales)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-300">
            <span className="font-semibold">Expected Cash:</span>
            <span className="font-semibold text-lg">{formatCurrency(expectedCash)}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Actual Cash Count
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <DollarSign className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={actualCash}
              onChange={(e) => setActualCash(e.target.value)}
              className="pl-10 text-lg"
              placeholder="0.00"
              required
              autoFocus
            />
          </div>
          {actualCash && (
            <div className={`mt-2 p-2 rounded text-sm font-medium ${
              variance < 0 ? 'bg-red-100 text-red-800' :
              variance > 0 ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              Variance: {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="Add any notes about this shift..."
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={closeShift.isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={closeShift.isPending}
            className="flex-1"
          >
            {closeShift.isPending ? 'Closing...' : 'Close Shift & Print Z-Report'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
