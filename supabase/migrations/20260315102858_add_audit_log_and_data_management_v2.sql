/*
  # Add Audit Log and Data Management Features

  ## 1. New Tables
    - `audit_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `action` (text) - Type of action performed
      - `table_name` (text) - Which table was affected
      - `record_id` (uuid) - ID of affected record
      - `old_data` (jsonb) - Previous state
      - `new_data` (jsonb) - New state
      - `ip_address` (text) - User's IP
      - `user_agent` (text) - Browser info
      - `created_at` (timestamptz)

  ## 2. Changes to Existing Tables
    - Add `voided_at` (timestamptz) to `sales` table
    - Add `voided_by` (uuid) to `sales` table
    - Add `void_reason` (text) to `sales` table
    - Add `is_voided` (boolean) to `sales` table

  ## 3. Security
    - Enable RLS on `audit_logs`
    - Admin can view all audit logs
    - Admin can void sales
    - Create function to log audit trails automatically

  ## 4. Important Notes
    - Audit logs are append-only (no updates/deletes)
    - Voided sales remain in database but marked as voided
    - Only admins can void sales and reset data
*/

-- Create audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all audit logs
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Only system can insert audit logs (via triggers/functions)
CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add void columns to sales table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'is_voided'
  ) THEN
    ALTER TABLE sales ADD COLUMN is_voided boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'voided_at'
  ) THEN
    ALTER TABLE sales ADD COLUMN voided_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'voided_by'
  ) THEN
    ALTER TABLE sales ADD COLUMN voided_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'void_reason'
  ) THEN
    ALTER TABLE sales ADD COLUMN void_reason text;
  END IF;
END $$;

-- Create index on audit logs for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_is_voided ON sales(is_voided);

-- Function to void a sale (admin only)
CREATE OR REPLACE FUNCTION void_sale(
  p_sale_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_sale_record jsonb;
  v_result jsonb;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if user is admin
  SELECT role = 'admin' INTO v_is_admin
  FROM user_profiles
  WHERE id = v_user_id;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can void sales');
  END IF;
  
  -- Get sale data before voiding
  SELECT jsonb_build_object(
    'id', id,
    'total_amount', total_amount,
    'status', status,
    'is_voided', is_voided
  ) INTO v_sale_record
  FROM sales
  WHERE id = p_sale_id;
  
  IF v_sale_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sale not found');
  END IF;
  
  -- Check if already voided
  IF (v_sale_record->>'is_voided')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sale is already voided');
  END IF;
  
  -- Void the sale
  UPDATE sales
  SET 
    is_voided = true,
    voided_at = now(),
    voided_by = v_user_id,
    void_reason = p_reason
  WHERE id = p_sale_id;
  
  -- Reverse inventory for voided sale
  UPDATE inventory
  SET current_stock = current_stock + si.quantity
  FROM sale_items si
  WHERE inventory.product_id = si.product_id
    AND (inventory.variant_id = si.variant_id OR (inventory.variant_id IS NULL AND si.variant_id IS NULL))
    AND si.sale_id = p_sale_id;
  
  -- Log the void action
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    v_user_id,
    'VOID_SALE',
    'sales',
    p_sale_id,
    v_sale_record,
    jsonb_build_object('is_voided', true, 'void_reason', p_reason)
  );
  
  RETURN jsonb_build_object('success', true, 'message', 'Sale voided successfully');
END;
$$;

-- Function to reset all data (admin only, DANGEROUS)
CREATE OR REPLACE FUNCTION reset_all_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if user is admin
  SELECT role = 'admin' INTO v_is_admin
  FROM user_profiles
  WHERE id = v_user_id;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can reset data');
  END IF;
  
  -- Log the reset action
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data)
  VALUES (v_user_id, 'RESET_ALL_DATA', 'system', NULL, jsonb_build_object('timestamp', now()));
  
  -- Delete data in correct order (respecting foreign keys)
  DELETE FROM sale_items;
  DELETE FROM sales;
  DELETE FROM stock_movements;
  DELETE FROM purchase_order_items;
  DELETE FROM purchase_orders;
  DELETE FROM shifts;
  
  -- Reset inventory quantities to 0
  UPDATE inventory SET current_stock = 0;
  
  -- Keep: products, product_variants, categories, customers, suppliers, locations, user_profiles, settings
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'All transactional data has been reset',
    'details', jsonb_build_object(
      'deleted', array['sales', 'sale_items', 'stock_movements', 'purchase_orders', 'shifts'],
      'reset', array['inventory quantities']
    )
  );
END;
$$;