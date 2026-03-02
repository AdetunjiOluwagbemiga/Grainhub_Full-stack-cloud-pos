/*
  # Enterprise POS System - Complete Database Schema

  ## Overview
  This migration creates a complete enterprise-grade Point of Sale system with advanced inventory
  management, multi-location support, loyalty programs, and comprehensive audit trails.

  ## 1. Core Tables
  
  ### User Management
  - `user_profiles` - Extended user information with roles
  - `activity_logs` - Complete audit trail of all system actions

  ### Product Management
  - `categories` - Product categories for organization
  - `products` - Base product information with SKU and pricing
  - `product_variants` - Size, color, and other variant options
  - `barcodes` - Multiple barcodes per product/variant

  ### Inventory Management
  - `locations` - Physical store/warehouse locations
  - `inventory` - Stock levels per product/location with batch tracking
  - `stock_transfers` - Inter-location stock movements
  - `purchase_orders` - Supplier orders and receiving
  - `stock_adjustments` - Manual adjustments (shrinkage, damage, etc.)

  ### Sales & Transactions
  - `customers` - Customer database with loyalty points
  - `sales` - Main sales transactions (completed, suspended, voided)
  - `sale_items` - Line items for each sale
  - `payments` - Split payment support (cash, card, gift card, wallet)
  - `refunds` - Product returns and refunds

  ### Financial Configuration
  - `tax_rules` - Configurable tax rates and rules
  - `payment_methods` - Available payment types

  ## 2. Security
  - Row Level Security (RLS) enabled on all tables
  - Role-based access control (Admin, Manager, Cashier)
  - Audit logging for all critical operations

  ## 3. Performance
  - Strategic indexes on foreign keys and frequently queried columns
  - Optimized for high-speed register operations
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. USER MANAGEMENT & RBAC
-- =====================================================

-- User roles enum
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'cashier');

-- User activity types
CREATE TYPE activity_type AS ENUM (
  'login', 'logout', 'sale', 'refund', 'void', 
  'stock_adjustment', 'product_create', 'product_update', 
  'price_change', 'settings_change', 'report_generate'
);

-- User profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'cashier',
  pin_code text, -- Encrypted PIN for quick login
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activity logs (audit trail)
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  activity_type activity_type NOT NULL,
  description text NOT NULL,
  metadata jsonb, -- Additional data about the activity
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- 2. PRODUCT MANAGEMENT
-- =====================================================

-- Product categories
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Main products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  unit_of_measure text DEFAULT 'piece', -- piece, kg, liter, etc.
  cost_price numeric(10, 2) NOT NULL DEFAULT 0,
  retail_price numeric(10, 2) NOT NULL DEFAULT 0,
  margin_percentage numeric(5, 2) GENERATED ALWAYS AS (
    CASE WHEN retail_price > 0 
    THEN ((retail_price - cost_price) / retail_price * 100)
    ELSE 0 END
  ) STORED,
  tax_rate numeric(5, 2) DEFAULT 0,
  has_variants boolean DEFAULT false,
  track_inventory boolean DEFAULT true,
  is_active boolean DEFAULT true,
  image_url text,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Product variants (size, color, etc.)
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku text UNIQUE NOT NULL,
  variant_name text NOT NULL, -- e.g., "Large / Red"
  variant_type text NOT NULL, -- e.g., "size", "color"
  variant_value text NOT NULL, -- e.g., "Large", "Red"
  cost_price numeric(10, 2) NOT NULL DEFAULT 0,
  retail_price numeric(10, 2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Barcodes (multiple per product/variant)
CREATE TABLE IF NOT EXISTS barcodes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  barcode text UNIQUE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT barcode_product_or_variant CHECK (
    (product_id IS NOT NULL AND variant_id IS NULL) OR
    (product_id IS NULL AND variant_id IS NOT NULL)
  )
);

-- =====================================================
-- 3. INVENTORY MANAGEMENT
-- =====================================================

-- Store/warehouse locations
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  address text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Inventory with batch tracking
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity numeric(10, 2) NOT NULL DEFAULT 0,
  low_stock_threshold numeric(10, 2) DEFAULT 10,
  batch_number text,
  expiry_date date,
  last_counted_at timestamptz,
  last_counted_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT inventory_product_or_variant CHECK (
    (product_id IS NOT NULL AND variant_id IS NULL) OR
    (product_id IS NULL AND variant_id IS NOT NULL)
  ),
  CONSTRAINT inventory_unique_item UNIQUE (location_id, product_id, variant_id, batch_number)
);

-- Stock transfers between locations
CREATE TABLE IF NOT EXISTS stock_transfers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_number text UNIQUE NOT NULL,
  from_location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  to_location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending', -- pending, in_transit, completed, cancelled
  notes text,
  transferred_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  received_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  transferred_at timestamptz,
  received_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Stock transfer items
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id uuid NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity numeric(10, 2) NOT NULL,
  batch_number text,
  created_at timestamptz DEFAULT now()
);

-- Purchase orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number text UNIQUE NOT NULL,
  supplier_name text NOT NULL,
  supplier_contact text,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft', -- draft, ordered, received, cancelled
  total_amount numeric(10, 2) DEFAULT 0,
  notes text,
  ordered_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  received_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  ordered_at timestamptz,
  received_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Purchase order items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity numeric(10, 2) NOT NULL,
  cost_price numeric(10, 2) NOT NULL,
  batch_number text,
  expiry_date date,
  created_at timestamptz DEFAULT now()
);

-- Stock adjustments (shrinkage, damage, etc.)
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  adjustment_number text UNIQUE NOT NULL,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity_change numeric(10, 2) NOT NULL, -- Can be negative
  reason text NOT NULL, -- shrinkage, damage, found, correction, etc.
  notes text,
  adjusted_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- 4. CUSTOMER MANAGEMENT
-- =====================================================

-- Customers with loyalty
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_code text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  loyalty_points integer DEFAULT 0,
  total_spent numeric(10, 2) DEFAULT 0,
  visit_count integer DEFAULT 0,
  last_visit_at timestamptz,
  date_of_birth date,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- 5. FINANCIAL CONFIGURATION
-- =====================================================

-- Tax rules
CREATE TABLE IF NOT EXISTS tax_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  rate numeric(5, 2) NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Payment methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  code text UNIQUE NOT NULL, -- cash, card, gift_card, wallet
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- 6. SALES & TRANSACTIONS
-- =====================================================

-- Sales status
CREATE TYPE sale_status AS ENUM ('completed', 'suspended', 'voided', 'refunded');

-- Main sales table
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_number text UNIQUE NOT NULL,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  cashier_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  status sale_status NOT NULL DEFAULT 'completed',
  subtotal numeric(10, 2) NOT NULL DEFAULT 0,
  discount_amount numeric(10, 2) DEFAULT 0,
  discount_percentage numeric(5, 2) DEFAULT 0,
  tax_amount numeric(10, 2) NOT NULL DEFAULT 0,
  total_amount numeric(10, 2) NOT NULL DEFAULT 0,
  amount_paid numeric(10, 2) DEFAULT 0,
  change_amount numeric(10, 2) DEFAULT 0,
  loyalty_points_earned integer DEFAULT 0,
  loyalty_points_redeemed integer DEFAULT 0,
  notes text,
  voided_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  voided_at timestamptz,
  void_reason text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Sale items (line items)
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES product_variants(id) ON DELETE RESTRICT,
  product_name text NOT NULL, -- Snapshot at time of sale
  sku text NOT NULL,
  quantity numeric(10, 2) NOT NULL,
  unit_price numeric(10, 2) NOT NULL,
  discount_amount numeric(10, 2) DEFAULT 0,
  discount_percentage numeric(5, 2) DEFAULT 0,
  tax_rate numeric(5, 2) DEFAULT 0,
  tax_amount numeric(10, 2) DEFAULT 0,
  line_total numeric(10, 2) NOT NULL,
  cost_price numeric(10, 2), -- For profit calculation
  created_at timestamptz DEFAULT now()
);

-- Payments (split payment support)
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method_id uuid NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
  amount numeric(10, 2) NOT NULL,
  reference_number text, -- Card transaction ID, etc.
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Refunds
CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  refund_number text UNIQUE NOT NULL,
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  sale_item_id uuid REFERENCES sale_items(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  refunded_by uuid NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  quantity numeric(10, 2) NOT NULL,
  refund_amount numeric(10, 2) NOT NULL,
  reason text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- User profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON user_profiles(is_active);

-- Activity logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_barcodes_barcode ON barcodes(barcode);
CREATE INDEX IF NOT EXISTS idx_barcodes_product_id ON barcodes(product_id);

-- Inventory
CREATE INDEX IF NOT EXISTS idx_inventory_location_id ON inventory(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry_date ON inventory(expiry_date);

-- Sales
CREATE INDEX IF NOT EXISTS idx_sales_sale_number ON sales(sale_number);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_cashier_id ON sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments(sale_id);

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_customer_code ON customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE barcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- User profiles policies
CREATE POLICY "Users can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admins can update profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- Activity logs policies
CREATE POLICY "Users can view own activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR get_user_role() IN ('admin', 'manager'));

CREATE POLICY "All users can insert activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Categories policies
CREATE POLICY "Users can view categories"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (get_user_role() IN ('admin', 'manager'))
  WITH CHECK (get_user_role() IN ('admin', 'manager'));

-- Products policies
CREATE POLICY "Users can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage products"
  ON products FOR ALL
  TO authenticated
  USING (get_user_role() IN ('admin', 'manager'))
  WITH CHECK (get_user_role() IN ('admin', 'manager'));

-- Product variants policies
CREATE POLICY "Users can view variants"
  ON product_variants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage variants"
  ON product_variants FOR ALL
  TO authenticated
  USING (get_user_role() IN ('admin', 'manager'))
  WITH CHECK (get_user_role() IN ('admin', 'manager'));

-- Barcodes policies
CREATE POLICY "Users can view barcodes"
  ON barcodes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage barcodes"
  ON barcodes FOR ALL
  TO authenticated
  USING (get_user_role() IN ('admin', 'manager'))
  WITH CHECK (get_user_role() IN ('admin', 'manager'));

-- Locations policies
CREATE POLICY "Users can view locations"
  ON locations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage locations"
  ON locations FOR ALL
  TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- Inventory policies
CREATE POLICY "Users can view inventory"
  ON inventory FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage inventory"
  ON inventory FOR ALL
  TO authenticated
  USING (get_user_role() IN ('admin', 'manager'))
  WITH CHECK (get_user_role() IN ('admin', 'manager'));

-- Stock transfers policies
CREATE POLICY "Users can view stock transfers"
  ON stock_transfers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage stock transfers"
  ON stock_transfers FOR ALL
  TO authenticated
  USING (get_user_role() IN ('admin', 'manager'))
  WITH CHECK (get_user_role() IN ('admin', 'manager'));

-- Stock transfer items policies
CREATE POLICY "Users can view stock transfer items"
  ON stock_transfer_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage stock transfer items"
  ON stock_transfer_items FOR ALL
  TO authenticated
  USING (get_user_role() IN ('admin', 'manager'))
  WITH CHECK (get_user_role() IN ('admin', 'manager'));

-- Purchase orders policies
CREATE POLICY "Users can view purchase orders"
  ON purchase_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage purchase orders"
  ON purchase_orders FOR ALL
  TO authenticated
  USING (get_user_role() IN ('admin', 'manager'))
  WITH CHECK (get_user_role() IN ('admin', 'manager'));

-- Purchase order items policies
CREATE POLICY "Users can view purchase order items"
  ON purchase_order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage purchase order items"
  ON purchase_order_items FOR ALL
  TO authenticated
  USING (get_user_role() IN ('admin', 'manager'))
  WITH CHECK (get_user_role() IN ('admin', 'manager'));

-- Stock adjustments policies
CREATE POLICY "Users can view stock adjustments"
  ON stock_adjustments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage stock adjustments"
  ON stock_adjustments FOR ALL
  TO authenticated
  USING (get_user_role() IN ('admin', 'manager'))
  WITH CHECK (get_user_role() IN ('admin', 'manager'));

-- Customers policies
CREATE POLICY "Users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage customers"
  ON customers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Tax rules policies
CREATE POLICY "Users can view tax rules"
  ON tax_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage tax rules"
  ON tax_rules FOR ALL
  TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- Payment methods policies
CREATE POLICY "Users can view payment methods"
  ON payment_methods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage payment methods"
  ON payment_methods FOR ALL
  TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- Sales policies
CREATE POLICY "Users can view sales"
  ON sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create sales"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own sales"
  ON sales FOR UPDATE
  TO authenticated
  USING (cashier_id = auth.uid() OR get_user_role() IN ('admin', 'manager'))
  WITH CHECK (cashier_id = auth.uid() OR get_user_role() IN ('admin', 'manager'));

-- Sale items policies
CREATE POLICY "Users can view sale items"
  ON sale_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create sale items"
  ON sale_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Payments policies
CREATE POLICY "Users can view payments"
  ON payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Refunds policies
CREATE POLICY "Users can view refunds"
  ON refunds FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can create refunds"
  ON refunds FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'manager'));

-- =====================================================
-- SEED DATA
-- =====================================================

-- Insert default location
INSERT INTO locations (name, code, address)
VALUES ('Main Store', 'MAIN', '123 Main Street')
ON CONFLICT (code) DO NOTHING;

-- Insert default payment methods
INSERT INTO payment_methods (name, code) VALUES
  ('Cash', 'cash'),
  ('Credit Card', 'card'),
  ('Debit Card', 'debit'),
  ('Gift Card', 'gift_card'),
  ('Digital Wallet', 'wallet')
ON CONFLICT (code) DO NOTHING;

-- Insert default tax rule
INSERT INTO tax_rules (name, rate) VALUES
  ('Standard VAT', 15.00),
  ('Zero Rated', 0.00)
ON CONFLICT DO NOTHING;