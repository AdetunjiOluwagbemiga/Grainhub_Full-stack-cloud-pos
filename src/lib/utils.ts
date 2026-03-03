import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatShortDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  discountPercentage: number = 0,
  discountAmount: number = 0,
  taxRate: number = 0
): { subtotal: number; discount: number; tax: number; total: number } {
  const subtotal = quantity * unitPrice;
  const discount = discountAmount || (subtotal * discountPercentage) / 100;
  const afterDiscount = subtotal - discount;
  const tax = (afterDiscount * taxRate) / 100;
  const total = afterDiscount + tax;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

export function calculateCartTotals(
  items: Array<{
    quantity: number;
    unit_price: number;
    discount_amount: number;
    discount_percentage: number;
    tax_rate: number;
  }>,
  orderDiscountPercentage: number = 0,
  orderDiscountAmount: number = 0
): {
  subtotal: number;
  itemDiscounts: number;
  orderDiscount: number;
  totalDiscount: number;
  taxAmount: number;
  total: number;
} {
  let subtotal = 0;
  let itemDiscounts = 0;
  let taxAmount = 0;

  items.forEach(item => {
    const itemSubtotal = item.quantity * item.unit_price;
    const itemDiscount = item.discount_amount || (itemSubtotal * item.discount_percentage) / 100;
    const afterDiscount = itemSubtotal - itemDiscount;
    const itemTax = (afterDiscount * item.tax_rate) / 100;

    subtotal += itemSubtotal;
    itemDiscounts += itemDiscount;
    taxAmount += itemTax;
  });

  const afterItemDiscounts = subtotal - itemDiscounts;
  const orderDiscount = orderDiscountAmount || (afterItemDiscounts * orderDiscountPercentage) / 100;
  const afterAllDiscounts = afterItemDiscounts - orderDiscount;

  const totalDiscount = itemDiscounts + orderDiscount;
  const total = afterAllDiscounts + taxAmount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    itemDiscounts: Math.round(itemDiscounts * 100) / 100,
    orderDiscount: Math.round(orderDiscount * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

export function generateReceiptHTML(
  sale: {
    sale_number: string;
    created_at: string;
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;
    amount_paid: number;
    change_amount: number;
  },
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>,
  storeName: string = 'POS System',
  storeAddress: string = ''
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @media print {
          @page {
            margin: 0;
            size: 80mm auto;
          }
          body { margin: 0; }
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          width: 80mm;
          margin: 0 auto;
          padding: 5mm;
        }
        .header {
          text-align: center;
          margin-bottom: 10px;
          border-bottom: 2px dashed #000;
          padding-bottom: 10px;
        }
        .header h1 {
          margin: 0;
          font-size: 18px;
        }
        .header p {
          margin: 2px 0;
          font-size: 10px;
        }
        .info {
          margin: 10px 0;
          font-size: 11px;
        }
        .items {
          margin: 10px 0;
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
          padding: 10px 0;
        }
        .item {
          margin: 5px 0;
        }
        .item-name {
          font-weight: bold;
        }
        .item-details {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
        }
        .totals {
          margin: 10px 0;
        }
        .total-line {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
        }
        .total-line.grand {
          font-weight: bold;
          font-size: 14px;
          margin-top: 5px;
          padding-top: 5px;
          border-top: 1px solid #000;
        }
        .footer {
          text-align: center;
          margin-top: 15px;
          padding-top: 10px;
          border-top: 2px dashed #000;
          font-size: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${storeName}</h1>
        ${storeAddress ? `<p>${storeAddress}</p>` : ''}
      </div>

      <div class="info">
        <div>Receipt #: ${sale.sale_number}</div>
        <div>Date: ${formatDate(sale.created_at)}</div>
      </div>

      <div class="items">
        ${items.map(item => `
          <div class="item">
            <div class="item-name">${item.product_name}</div>
            <div class="item-details">
              <span>${item.quantity} x ${formatCurrency(item.unit_price)}</span>
              <span>${formatCurrency(item.line_total)}</span>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="totals">
        <div class="total-line">
          <span>Subtotal:</span>
          <span>${formatCurrency(sale.subtotal)}</span>
        </div>
        ${sale.discount_amount > 0 ? `
          <div class="total-line">
            <span>Discount:</span>
            <span>-${formatCurrency(sale.discount_amount)}</span>
          </div>
        ` : ''}
        <div class="total-line">
          <span>Tax:</span>
          <span>${formatCurrency(sale.tax_amount)}</span>
        </div>
        <div class="total-line grand">
          <span>TOTAL:</span>
          <span>${formatCurrency(sale.total_amount)}</span>
        </div>
        <div class="total-line">
          <span>Paid:</span>
          <span>${formatCurrency(sale.amount_paid)}</span>
        </div>
        <div class="total-line">
          <span>Change:</span>
          <span>${formatCurrency(sale.change_amount)}</span>
        </div>
      </div>

      <div class="footer">
        <p>Thank you for your purchase!</p>
        <p>Please visit us again</p>
      </div>
    </body>
    </html>
  `;
}

export function printReceipt(html: string) {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    throw new Error('Print window was blocked by browser. Please allow popups for this site.');
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    setTimeout(() => {
      printWindow.close();
    }, 100);
  }, 250);
}

export function downloadReceipt(html: string, filename: string = 'receipt.html') {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
