import * as XLSX from 'xlsx';
import { supabase } from './supabase';

export interface ProductExcelRow {
  SKU: string;
  Name: string;
  Description?: string;
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

            if (existingProduct.data) {
              const { error } = await supabase
                .from('products')
                .update(productData)
                .eq('id', existingProduct.data.id);

              if (error) throw error;
            } else {
              const { error } = await supabase
                .from('products')
                .insert([productData]);

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

export function downloadExcelTemplate() {
  const templateData: ProductExcelRow[] = [
    {
      SKU: 'EXAMPLE-001',
      Name: 'Example Product',
      Description: 'Product description',
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

export async function exportInventoryToExcel(inventory: any[]) {
  const data: InventoryExcelRow[] = inventory.map((item) => ({
    SKU: item.products?.sku || '',
    'Product Name': item.products?.name || '',
    Location: item.locations?.name || '',
    Quantity: item.quantity_on_hand,
    'Reorder Level': item.reorder_level || 0,
    'Reorder Quantity': item.reorder_quantity || 0,
  }));

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
