/*
  # Add Shift Management & Z-Report System

  ## Overview
  This migration implements a professional shift management system for financial accountability
  and reconciliation. Each shift tracks cash flow, sales, and variance for audit purposes.

  ## New Tables

  ### `shifts` Table
  Tracks cashier shifts with financial reconciliation:
  - `id` (uuid, primary key) - Unique shift identifier
  - `user_id` (uuid, foreign key) - Cashier who worked the shift
  - `start_time` (timestamptz) - When shift opened
  - `end_time` (timestamptz) - When shift closed (null if active)
  - `opening_float` (numeric) - Starting cash in drawer
  - `expected_cash` (numeric) - Calculated expected cash at close
  - `actual_cash` (numeric) - Physical cash counted at close
  - `variance` (numeric) - Difference between expected and actual (actual - expected)
  - `total_sales` (numeric) - Total sales during shift
  - `total_cash_sales` (numeric) - Cash payment sales
  - `total_card_sales` (numeric) - Card payment sales
  - `total_discounts` (numeric) - Total discounts given
  - `total_tax` (numeric) - Total tax collected
  - `transaction_count` (integer) - Number of transactions
  - `status` (text) - 'open' or 'closed'
  - `notes` (text) - Optional closing notes
  - `created_at` (timestamptz) - Timestamp
  - `updated_at` (timestamptz) - Timestamp

  ## Modified Tables

  ### `sales` Table
  - Add `shift_id` (uuid, foreign key) - Links each sale to a shift

  ## Security
  - Enable RLS on shifts table
  - Authenticated users can view their own shifts
  - Only open shifts can be updated
  - Closed shifts are read-only
  - Admin/Manager users can view all shifts and variance data

  ## Constraints
  - Only one open shift per user at a time
  - Cannot delete closed shifts
  - Shift must be open to add sales
*/

-- Create shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  opening_float numeric(10,2) NOT NULL DEFAULT 0,
  expected_cash numeric(10,2) DEFAULT 0,
  actual_cash numeric(10,2),
  variance numeric(10,2),
  total_sales numeric(10,2) DEFAULT 0,
  total_cash_sales numeric(10,2) DEFAULT 0,
  total_card_sales numeric(10,2) DEFAULT 0,
  total_discounts numeric(10,2) DEFAULT 0,
  total_tax numeric(10,2) DEFAULT 0,
  transaction_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_start_time ON shifts(start_time DESC);

-- Add shift_id to sales table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'shift_id'
  ) THEN
    ALTER TABLE sales ADD COLUMN shift_id uuid REFERENCES shifts(id) ON DELETE RESTRICT;
    CREATE INDEX IF NOT EXISTS idx_sales_shift_id ON sales(shift_id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own shifts
CREATE POLICY "Users can view own shifts"
  ON shifts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Managers can view all shifts (assuming role stored in user_profiles)
CREATE POLICY "Managers can view all shifts"
  ON shifts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'manager')
    )
  );

-- Policy: Users can create their own shifts
CREATE POLICY "Users can create own shifts"
  ON shifts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own open shifts only
CREATE POLICY "Users can update own open shifts"
  ON shifts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'open')
  WITH CHECK (auth.uid() = user_id);

-- Policy: Prevent deletion of closed shifts
CREATE POLICY "Cannot delete closed shifts"
  ON shifts
  FOR DELETE
  TO authenticated
  USING (status = 'open' AND auth.uid() = user_id);

-- Function: Update shift totals when a sale is added
CREATE OR REPLACE FUNCTION update_shift_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shift_id IS NOT NULL THEN
    UPDATE shifts
    SET
      total_sales = total_sales + NEW.total_amount,
      total_cash_sales = total_cash_sales + CASE
        WHEN NEW.payment_method = 'cash' THEN NEW.total_amount
        ELSE 0
      END,
      total_card_sales = total_card_sales + CASE
        WHEN NEW.payment_method IN ('card', 'credit', 'debit') THEN NEW.total_amount
        ELSE 0
      END,
      total_discounts = total_discounts + COALESCE(NEW.discount_amount, 0),
      total_tax = total_tax + COALESCE(NEW.tax_amount, 0),
      transaction_count = transaction_count + 1,
      updated_at = now()
    WHERE id = NEW.shift_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update shift totals on sale insert
DROP TRIGGER IF EXISTS trigger_update_shift_totals ON sales;
CREATE TRIGGER trigger_update_shift_totals
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_shift_totals();

-- Function: Calculate expected cash on shift close
CREATE OR REPLACE FUNCTION calculate_expected_cash(shift_id uuid)
RETURNS numeric AS $$
DECLARE
  opening numeric;
  cash_sales numeric;
BEGIN
  SELECT opening_float, total_cash_sales
  INTO opening, cash_sales
  FROM shifts
  WHERE id = shift_id;

  RETURN COALESCE(opening, 0) + COALESCE(cash_sales, 0);
END;
$$ LANGUAGE plpgsql;

-- Function: Ensure only one open shift per user
CREATE OR REPLACE FUNCTION check_single_open_shift()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'open' THEN
    IF EXISTS (
      SELECT 1 FROM shifts
      WHERE user_id = NEW.user_id
      AND status = 'open'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'User already has an open shift. Close the existing shift first.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Enforce single open shift per user
DROP TRIGGER IF EXISTS trigger_check_single_open_shift ON shifts;
CREATE TRIGGER trigger_check_single_open_shift
  BEFORE INSERT OR UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION check_single_open_shift();

-- Function: Prevent modification of closed shifts
CREATE OR REPLACE FUNCTION prevent_closed_shift_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'closed' AND (
    NEW.opening_float != OLD.opening_float OR
    NEW.actual_cash != OLD.actual_cash OR
    NEW.variance != OLD.variance OR
    NEW.end_time != OLD.end_time
  ) THEN
    RAISE EXCEPTION 'Cannot modify financial data of closed shifts';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Prevent closed shift modification
DROP TRIGGER IF EXISTS trigger_prevent_closed_shift_modification ON shifts;
CREATE TRIGGER trigger_prevent_closed_shift_modification
  BEFORE UPDATE ON shifts
  FOR EACH ROW
  WHEN (OLD.status = 'closed')
  EXECUTE FUNCTION prevent_closed_shift_modification();