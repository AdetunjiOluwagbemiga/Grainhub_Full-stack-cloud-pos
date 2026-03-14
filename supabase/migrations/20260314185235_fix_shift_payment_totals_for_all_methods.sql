/*
  # Fix Shift Payment Totals for All Payment Methods
  
  1. Changes
    - Update the `update_shift_payment_totals()` function to correctly categorize all payment methods
    - POS, card, debit should count as card sales
    - Cash should count as cash sales
    - Digital wallet and gift cards count as card sales
  
  2. Security
    - Maintains existing RLS policies
    - No changes to permissions
*/

-- Drop and recreate the function with proper payment method mapping
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
        WHEN payment_method_code IN ('card', 'debit', 'pos', 'wallet', 'gift_card', 'credit_card', 'debit_card') THEN NEW.amount
        ELSE 0
      END,
      updated_at = now()
    WHERE id = sale_shift_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;