import * as XLSX from 'xlsx';
import { supabase } from './supabase';

export interface ProductExcelRow {
  SKU: string;
  Name: string;
  Description?: string;
  'Current Stock': number;
  'Cost Price': number;
  'Retail Price': number;
  'Tax Rate (%)': number;
  'Unit of Measure': string;
}

export async function exportProductsToExcel(products: any[]) {
  const data: ProductExcelRow[] = products.map((product) => ({
    SKU: product.sku,
    Name: product.name,
    Description: product.description || '',
    'Current Stock': product.current_stock || 0,
    'Cost Price': product.cost_price,
    'Retail Price': product.retail_price,
    'Tax Rate (%)': product.tax_rate,
    'Unit of Measure': product.unit_of_measure,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  const colWidths = [
    { wch: 15 },
    { wch: 30 },
    { wch: 40 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

  const fileName = `products_export_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

export async function importProductsFromExcel(
  file: File,
  userId: string | null
): Promise<{ success: number; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<ProductExcelRow>(worksheet);

        const errors: string[] = [];
        let successCount = 0;

        const { data: defaultLocation } = await supabase
          .from('locations')
          .select('id')
          .eq('is_default', true)
          .maybeSingle();

        if (!defaultLocation) {
          reject(new Error('No default location found. Please create a location first.'));
          return;
        }

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          const rowNum = i + 2;

          try {
            if (!row.SKU || !row.Name || !row['Retail Price']) {
              errors.push(`Row ${rowNum}: Missing required fields (SKU, Name, or Retail Price)`);
              continue;
            }

            const existingProduct = await supabase
              .from('products')
              .select('id')
              .eq('sku', row.SKU)
              .maybeSingle();

            const productData = {
              sku: row.SKU,
              name: row.Name,
              description: row.Description || null,
              cost_price: row['Cost Price'] || 0,
              retail_price: row['Retail Price'],
              tax_rate: row['Tax Rate (%)'] || 0,
              unit_of_measure: row['Unit of Measure'] || 'piece',
              category_id: null,
              has_variants: false,
              track_inventory: true,
              is_active: true,
              image_url: null,
              created_by: userId,
            };

            let productId: string;

            if (existingProduct.data) {
              const { error } = await supabase
                .from('products')
                .update(productData)
                .eq('id', existingProduct.data.id);

              if (error) throw error;
              productId = existingProduct.data.id;
            } else {
              const { data: newProduct, error } = await supabase
                .from('products')
                .insert([productData])
                .select('id')
                .single();

              if (error) throw error;
              productId = newProduct.id;
            }

            // Update or create inventory record for the product
            const currentStock = row['Current Stock'] !== undefined ? row['Current Stock'] : 0;

            const { data: existingInventory } = await supabase
              .from('inventory')
              .select('id, quantity')
              .eq('product_id', productId)
              .eq('location_id', defaultLocation.id)
              .maybeSingle();

            if (existingInventory) {
              // Update existing inventory
              const { error: invError } = await supabase
                .from('inventory')
                .update({ quantity: currentStock })
                .eq('id', existingInventory.id);

              if (invError) throw new Error(`Failed to update inventory: ${invError.message}`);
            } else {
              // Create new inventory record
              const { error: invError } = await supabase
                .from('inventory')
                .insert([{
                  product_id: productId,
                  location_id: defaultLocation.id,
                  quantity: currentStock,
                  low_stock_threshold: 5,
                  reorder_quantity: 10
                }]);

              if (invError) throw new Error(`Failed to create inventory: ${invError.message}`);
            }

            successCount++;
          } catch (error: any) {
            errors.push(`Row ${rowNum} (${row.SKU}): ${error.message}`);
          }
        }

        resolve({ success: successCount, errors });
      } catch (error: any) {
        reject(new Error(`Failed to parse Excel file: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsBinaryString(file);
  });
}

export function downloadExcelTemplate() {
  const templateData: ProductExcelRow[] = [
    {
      SKU: 'EXAMPLE-001',
      Name: 'Example Product',
      Description: 'Product description',
      'Current Stock': 0,
      'Cost Price': 10.00,
      'Retail Price': 20.00,
      'Tax Rate (%)': 15,
      'Unit of Measure': 'piece',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);

  const colWidths = [
    { wch: 15 },
    { wch: 30 },
    { wch: 40 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

  XLSX.writeFile(workbook, 'product_import_template.xlsx');
}

export interface InventoryExcelRow {
  SKU: string;
  'Product Name': string;
  Location: string;
  Quantity: number;
  'Reorder Level': number;
  'Reorder Quantity': number;
}

export async function exportInventoryToExcel(inventory?: any[]) {
  let data: InventoryExcelRow[];

  if (inventory && inventory.length > 0) {
    data = inventory.map((item) => ({
      SKU: item.product?.sku || item.sku || '',
      'Product Name': item.product?.name || item.name || item.variant?.variant_name || '',
      Location: item.location?.name || 'Unknown Location',
      Quantity: Number(item.quantity) || 0,
      'Reorder Level': Number(item.low_stock_threshold) || 0,
      'Reorder Quantity': 0,
    }));
  } else {
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        sku,
        name,
        inventory (
          quantity,
          low_stock_threshold,
          location:locations (name)
        )
      `)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    data = (products || []).map((product: any) => {
      const inv = product.inventory?.[0];
      return {
        SKU: product.sku,
        'Product Name': product.name,
        Location: inv?.location?.name || 'Main Store',
        Quantity: inv?.quantity || 0,
        'Reorder Level': inv?.low_stock_threshold || 0,
        'Reorder Quantity': 0,
      };
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(data);

  const colWidths = [
    { wch: 15 },
    { wch: 30 },
    { wch: 20 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');

  const fileName = `inventory_export_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

export async function importInventoryFromExcel(
  file: File,
  locationId: string
): Promise<{ success: number; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<InventoryExcelRow>(worksheet);

        const errors: string[] = [];
        let successCount = 0;

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          const rowNum = i + 2;

          try {
            if (!row.SKU || row.Quantity === undefined) {
              errors.push(`Row ${rowNum}: Missing required fields (SKU or Quantity)`);
              continue;
            }

            const product = await supabase
              .from('products')
              .select('id')
              .eq('sku', row.SKU)
              .maybeSingle();

            if (!product.data) {
              errors.push(`Row ${rowNum}: Product with SKU "${row.SKU}" not found`);
              continue;
            }

            const existingInventory = await supabase
              .from('inventory')
              .select('id')
              .eq('product_id', product.data.id)
              .eq('location_id', locationId)
              .maybeSingle();

            const inventoryData = {
              product_id: product.data.id,
              location_id: locationId,
              quantity_on_hand: row.Quantity,
              reorder_level: row['Reorder Level'] || 0,
              reorder_quantity: row['Reorder Quantity'] || 0,
            };

            if (existingInventory.data) {
              const { error } = await supabase
                .from('inventory')
                .update(inventoryData)
                .eq('id', existingInventory.data.id);

              if (error) throw error;
            } else {
              const { error } = await supabase
                .from('inventory')
                .insert([inventoryData]);

              if (error) throw error;
            }

            successCount++;
          } catch (error: any) {
            errors.push(`Row ${rowNum} (${row.SKU}): ${error.message}`);
          }
        }

        resolve({ success: successCount, errors });
      } catch (error: any) {
        reject(new Error(`Failed to parse Excel file: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsBinaryString(file);
  });
}

export function downloadInventoryTemplate() {
  const templateData: InventoryExcelRow[] = [
    {
      SKU: 'EXAMPLE-001',
      'Product Name': 'Example Product',
      Location: 'Main Store',
      Quantity: 100,
      'Reorder Level': 10,
      'Reorder Quantity': 50,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);

  const colWidths = [
    { wch: 15 },
    { wch: 30 },
    { wch: 20 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');

  XLSX.writeFile(workbook, 'inventory_import_template.xlsx');
}

export interface CustomerExcelRow {
  'Customer ID': string;
  Name: string;
  Email?: string;
  Phone?: string;
  'Loyalty Points': number;
  'Total Spent': number;
}

export async function exportCustomersToExcel(customers: any[]) {
  const data: CustomerExcelRow[] = customers.map((customer) => ({
    'Customer ID': customer.customer_code,
    Name: customer.name,
    Email: customer.email || '',
    Phone: customer.phone || '',
    'Loyalty Points': customer.loyalty_points || 0,
    'Total Spent': customer.total_spent || 0,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  const colWidths = [
    { wch: 15 },
    { wch: 30 },
    { wch: 30 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

  const fileName = `customers_export_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

export async function importCustomersFromExcel(
  file: File
): Promise<{ success: number; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<CustomerExcelRow>(worksheet);

        const errors: string[] = [];
        let successCount = 0;

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          const rowNum = i + 2;

          try {
            if (!row.Name) {
              errors.push(`Row ${rowNum}: Missing required field (Name)`);
              continue;
            }

            let customerCode = row['Customer ID'];
            if (!customerCode) {
              customerCode = `CUST-${Date.now()}-${i}`;
            }

            const existingCustomer = await supabase
              .from('customers')
              .select('id')
              .eq('customer_code', customerCode)
              .maybeSingle();

            const customerData = {
              customer_code: customerCode,
              name: row.Name,
              email: row.Email || null,
              phone: row.Phone || null,
              loyalty_points: row['Loyalty Points'] || 0,
              total_spent: row['Total Spent'] || 0,
              is_active: true,
            };

            if (existingCustomer.data) {
              const { error } = await supabase
                .from('customers')
                .update(customerData)
                .eq('id', existingCustomer.data.id);

              if (error) throw error;
            } else {
              const { error } = await supabase
                .from('customers')
                .insert([customerData]);

              if (error) throw error;
            }

            successCount++;
          } catch (error: any) {
            errors.push(`Row ${rowNum} (${row.Name}): ${error.message}`);
          }
        }

        resolve({ success: successCount, errors });
      } catch (error: any) {
        reject(new Error(`Failed to parse Excel file: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsBinaryString(file);
  });
}

export function downloadCustomerTemplate() {
  const templateData: CustomerExcelRow[] = [
    {
      'Customer ID': 'CUST-001',
      Name: 'John Doe',
      Email: 'john@example.com',
      Phone: '+1234567890',
      'Loyalty Points': 0,
      'Total Spent': 0,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);

  const colWidths = [
    { wch: 15 },
    { wch: 30 },
    { wch: 30 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

  XLSX.writeFile(workbook, 'customer_import_template.xlsx');
}

export interface SalesExcelRow {
  'Sale ID': string;
  Date: string;
  Customer: string;
  'Payment Method': string;
  Subtotal: number;
  Tax: number;
  Total: number;
  Cashier: string;
  Status: string;
}

export async function exportSalesToExcel(sales: any[]) {
  const data: SalesExcelRow[] = sales.map((sale) => ({
    'Sale ID': sale.receipt_number,
    Date: new Date(sale.created_at).toLocaleString(),
    Customer: sale.customers?.name || 'Walk-in',
    'Payment Method': sale.payments?.[0]?.payment_method || 'N/A',
    Subtotal: sale.subtotal,
    Tax: sale.tax_amount,
    Total: sale.total_amount,
    Cashier: sale.user_profiles?.full_name || 'Unknown',
    Status: sale.status,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  const colWidths = [
    { wch: 15 },
    { wch: 20 },
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 20 },
    { wch: 12 },
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales');

  const fileName = `sales_export_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

export interface ValuationExcelRow {
  SKU: string;
  'Product Name': string;
  Category: string;
  'Stock Quantity': number;
  'Cost Price': number;
  'Retail Price': number;
  'Total Cost Value': number;
  'Total Retail Value': number;
  'Potential Profit': number;
  'Margin %': number;
  Status: string;
}

export function exportValuationToExcel(valuationData: any[], summary: any) {
  const timestamp = new Date().toISOString();
  const dateStr = timestamp.split('T')[0];

  const summaryData = [
    ['INVENTORY VALUATION REPORT'],
    [`Generated: ${new Date(timestamp).toLocaleString()}`],
    [''],
    ['SUMMARY'],
    ['Total Products', summary.total_products],
    ['Total Stock Units', summary.total_stock],
    ['Total Asset Value (Cost)', summary.total_cost_value],
    ['Total Revenue Potential (Retail)', summary.total_retail_value],
    ['Projected Gross Profit', summary.total_potential_profit],
    ['Average Margin %', `${summary.average_margin_percentage?.toFixed(2)}%`],
    [''],
    ['DATA QUALITY ALERTS'],
    ['Products Needing Costing', summary.products_needing_costing],
    ['Products with Negative Stock', summary.products_with_negative_stock],
    ['Low Margin Products (<10%)', summary.low_margin_products],
    [''],
    [''],
  ];

  const data: ValuationExcelRow[] = valuationData
    .filter(item => !item.has_negative_stock)
    .map((item) => ({
      SKU: item.sku,
      'Product Name': item.product_name,
      Category: item.category_name || 'Uncategorized',
      'Stock Quantity': item.stock_quantity,
      'Cost Price': item.cost_price,
      'Retail Price': item.retail_price,
      'Total Cost Value': item.total_cost_value,
      'Total Retail Value': item.total_retail_value,
      'Potential Profit': item.potential_profit,
      'Margin %': parseFloat(item.margin_percentage.toFixed(2)),
      Status: item.needs_costing ? 'Needs Costing' : item.stock_status,
    }));

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 35 }, { wch: 20 }];

  const dataSheet = XLSX.utils.json_to_sheet(data);
  dataSheet['!cols'] = [
    { wch: 15 },
    { wch: 30 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 10 },
    { wch: 15 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Detailed Valuation');

  const fileName = `inventory_valuation_${dateStr}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
