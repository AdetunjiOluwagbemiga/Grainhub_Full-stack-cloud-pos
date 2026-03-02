/*
  # Fix Shift Totals Trigger
  
  ## Changes
  This migration fixes the `update_shift_totals()` trigger which was incorrectly referencing
  a non-existent `payment_method` column on the `sales` table. The payment information is
  actually stored in the separate `payments` table.
  
  ## Changes Made
  1. Drop the old trigger and function
  2. Create new trigger on the `payments` table instead
  3. Update shift totals based on payment methods from the `payments` table
  4. Keep the sales trigger for transaction count, discounts, and tax
  
  ## Notes
  - Cash vs card sales are now correctly calculated from the `payments` table
  - Transaction counts, discounts, and tax still come from the `sales` table
*/

-- Drop the old trigger and function
DROP TRIGGER IF EXISTS trigger_update_shift_totals ON sales;
DROP FUNCTION IF EXISTS update_shift_totals();

-- Create function to update shift totals from sales (transaction count, discounts, tax)
CREATE OR REPLACE FUNCTION update_shift_sales_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shift_id IS NOT NULL THEN
    UPDATE shifts
    SET
      total_sales = total_sales + NEW.total_amount,
      total_discounts = total_discounts + COALESCE(NEW.discount_amount, 0),
      total_tax = total_tax + COALESCE(NEW.tax_amount, 0),
      transaction_count = transaction_count + 1,
      updated_at = now()
    WHERE id = NEW.shift_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for sales
CREATE TRIGGER trigger_update_shift_sales_totals
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_shift_sales_totals();

-- Create function to update shift payment totals from payments table
CREATE OR REPLACE FUNCTION update_shift_payment_totals()
RETURNS TRIGGER AS $$
DECLARE
  sale_shift_id uuid;
  payment_method_code text;
BEGIN
  -- Get the shift_id from the related sale
  SELECT shift_id INTO sale_shift_id
  FROM sales
  WHERE id = NEW.sale_id;
  
  -- Get the payment method code
  SELECT code INTO payment_method_code
  FROM payment_methods
  WHERE id = NEW.payment_method_id;
  
  -- Update shift totals if sale has a shift
  IF sale_shift_id IS NOT NULL THEN
    UPDATE shifts
    SET
      total_cash_sales = total_cash_sales + CASE
        WHEN payment_method_code = 'cash' THEN NEW.amount
        ELSE 0
      END,
      total_card_sales = total_card_sales + CASE
        WHEN payment_method_code IN ('card', 'credit_card', 'debit_card') THEN NEW.amount
        ELSE 0
      END,
      updated_at = now()
    WHERE id = sale_shift_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payments
DROP TRIGGER IF EXISTS trigger_update_shift_payment_totals ON payments;
CREATE TRIGGER trigger_update_shift_payment_totals
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_shift_payment_totals();