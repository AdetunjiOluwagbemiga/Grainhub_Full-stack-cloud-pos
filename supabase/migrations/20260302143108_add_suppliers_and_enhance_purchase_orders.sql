/*
  # Add Suppliers & Enhance Purchase Order Management

  ## Overview
  This migration adds a suppliers table and enhances the existing purchase order system
  with supplier relationships, receiving workflow, and automatic inventory updates.

  ## New Tables

  ### `suppliers` Table
  Stores vendor information for procurement:
  - `id` (uuid, primary key) - Unique supplier identifier
  - `name` (text) - Supplier company name
  - `contact_person` (text) - Primary contact name
  - `phone` (text) - Contact phone number
  - `email` (text) - Contact email address
  - `address` (text) - Physical address
  - `tax_id` (text) - Tax identification number
  - `notes` (text) - Additional notes
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz) - Timestamp
  - `updated_at` (timestamptz) - Timestamp

  ### `stock_movements` Table
  Tracks all inventory movements for audit:
  - `id` (uuid, primary key) - Unique movement identifier
  - `product_id` (uuid, foreign key) - Product reference
  - `movement_type` (text) - 'purchase', 'sale', 'adjustment', 'return'
  - `quantity` (numeric) - Quantity moved
  - `reference_type` (text) - 'purchase_order', 'sale', 'manual'
  - `reference_id` (uuid) - ID of related record
  - `notes` (text) - Movement notes
  - `created_by` (uuid, foreign key) - User who created movement
  - `created_at` (timestamptz) - Timestamp

  ## Modified Tables

  ### `purchase_orders` Table
  - Add `supplier_id` (uuid, foreign key) - Reference to suppliers table
  - Add `expected_delivery` (date) - Expected delivery date

  ### `purchase_order_items` Table
  - Add `quantity_received` (numeric) - Quantity received
  - Add `unit_cost` (numeric) - Renamed from cost_price for clarity

  ## Security
  - Enable RLS on all new tables
  - Authenticated users can view suppliers and POs
  - Only admins and managers can create/edit suppliers and POs
*/

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  tax_id text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);

-- Create stock_movements table
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN ('purchase', 'sale', 'adjustment', 'return')),
  quantity numeric(10,2) NOT NULL,
  reference_type text CHECK (reference_type IN ('purchase_order', 'sale', 'manual')),
  reference_id uuid,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);

-- Add supplier_id to purchase_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN supplier_id uuid REFERENCES suppliers(id) ON DELETE RESTRICT;
    CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
  END IF;
END $$;

-- Add expected_delivery to purchase_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'expected_delivery'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN expected_delivery date;
  END IF;
END $$;

-- Add quantity_received to purchase_order_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_order_items' AND column_name = 'quantity_received'
  ) THEN
    ALTER TABLE purchase_order_items ADD COLUMN quantity_received numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Add unit_cost alias (keep cost_price for compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_order_items' AND column_name = 'unit_cost'
  ) THEN
    ALTER TABLE purchase_order_items ADD COLUMN unit_cost numeric(10,2);
    UPDATE purchase_order_items SET unit_cost = cost_price WHERE unit_cost IS NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Suppliers policies
CREATE POLICY "Authenticated users can view suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and managers can manage suppliers"
  ON suppliers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'manager')
    )
  );

-- Stock movements policies
CREATE POLICY "Authenticated users can view stock movements"
  ON stock_movements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and managers can create stock movements"
  ON stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'manager')
    )
  );

-- Function: Update product stock on PO receiving
CREATE OR REPLACE FUNCTION update_stock_on_po_receive()
RETURNS TRIGGER AS $$
DECLARE
  qty_diff numeric;
  po_creator uuid;
BEGIN
  IF NEW.quantity_received != OLD.quantity_received THEN
    qty_diff := NEW.quantity_received - COALESCE(OLD.quantity_received, 0);
    
    UPDATE products
    SET updated_at = now()
    WHERE id = NEW.product_id;
    
    UPDATE inventory
    SET 
      quantity = quantity + qty_diff,
      updated_at = now()
    WHERE product_id = NEW.product_id
      AND location_id = (SELECT location_id FROM purchase_orders WHERE id = NEW.po_id);
    
    SELECT ordered_by INTO po_creator
    FROM purchase_orders
    WHERE id = NEW.po_id;
    
    INSERT INTO stock_movements (
      product_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      notes,
      created_by
    )
    SELECT
      NEW.product_id,
      'purchase',
      qty_diff,
      'purchase_order',
      NEW.po_id,
      'Received from PO: ' || po.po_number,
      COALESCE(po_creator, auth.uid())
    FROM purchase_orders po
    WHERE po.id = NEW.po_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update stock on receive
DROP TRIGGER IF EXISTS trigger_update_stock_on_po_receive ON purchase_order_items;
CREATE TRIGGER trigger_update_stock_on_po_receive
  AFTER UPDATE OF quantity_received ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_po_receive();

-- Function: Auto-update PO status based on receiving
CREATE OR REPLACE FUNCTION auto_update_po_status_on_receive()
RETURNS TRIGGER AS $$
DECLARE
  total_ordered numeric;
  total_received numeric;
  po_status text;
BEGIN
  SELECT 
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(quantity_received), 0)
  INTO total_ordered, total_received
  FROM purchase_order_items
  WHERE po_id = COALESCE(NEW.po_id, OLD.po_id);
  
  IF total_received = 0 THEN
    po_status := 'pending';
  ELSIF total_received >= total_ordered THEN
    po_status := 'received';
  ELSE
    po_status := 'partial';
  END IF;
  
  UPDATE purchase_orders
  SET 
    status = po_status,
    received_at = CASE 
      WHEN po_status = 'received' AND received_at IS NULL THEN now()
      ELSE received_at
    END,
    updated_at = now()
  WHERE id = COALESCE(NEW.po_id, OLD.po_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update PO status
DROP TRIGGER IF EXISTS trigger_auto_update_po_status_on_receive ON purchase_order_items;
CREATE TRIGGER trigger_auto_update_po_status_on_receive
  AFTER UPDATE OF quantity_received ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_po_status_on_receive();

-- Function: Update timestamps
CREATE OR REPLACE FUNCTION update_supplier_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update supplier timestamps
DROP TRIGGER IF EXISTS trigger_suppliers_updated_at ON suppliers;
CREATE TRIGGER trigger_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_timestamp();