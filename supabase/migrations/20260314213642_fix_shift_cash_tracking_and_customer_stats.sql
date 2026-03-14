/*
  # Fix Shift Cash Tracking and Customer Stats

  1. Shift Cash Tracking Fix
    - Modify update_shift_payment_totals trigger to use sale.total_amount
    - Previously used payment.amount which included change given to customer
    - This caused inflated cash sales and incorrect variance

  2. Customer Stats Auto-Update
    - Modify complete_sale RPC to update customer stats
    - Updates total_spent, visit_count, last_visit_at
    - Only updates if customer_id is provided

  3. Voided Sales Shift Adjustment
    - Subtract voided sales from shift totals
    - Decrement transaction count
*/

-- Fix: Update shift payment totals trigger
CREATE OR REPLACE FUNCTION update_shift_payment_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_shift_id UUID;
  v_payment_method_code TEXT;
  v_sale_total NUMERIC;
BEGIN
  -- Get the shift_id and sale total from the sale
  SELECT s.shift_id, s.total_amount INTO v_shift_id, v_sale_total
  FROM sales s
  WHERE s.id = NEW.sale_id;

  -- Only proceed if sale is part of a shift
  IF v_shift_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the payment method code
  SELECT pm.code INTO v_payment_method_code
  FROM payment_methods pm
  WHERE pm.id = NEW.payment_method_id;

  -- Update the appropriate payment method total using ACTUAL SALE AMOUNT
  IF v_payment_method_code = 'cash' THEN
    UPDATE shifts
    SET total_cash_sales = COALESCE(total_cash_sales, 0) + v_sale_total,
        updated_at = NOW()
    WHERE id = v_shift_id;
  ELSIF v_payment_method_code = 'card' OR v_payment_method_code = 'pos' THEN
    UPDATE shifts
    SET total_card_sales = COALESCE(total_card_sales, 0) + v_sale_total,
        updated_at = NOW()
    WHERE id = v_shift_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_update_shift_payment_totals ON payments;
CREATE TRIGGER trigger_update_shift_payment_totals
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_shift_payment_totals();

-- Fix: Update complete_sale function to include customer stats
CREATE OR REPLACE FUNCTION complete_sale(
  p_sale_id UUID,
  p_cashier_id UUID,
  p_location_id UUID,
  p_customer_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::JSONB,
  p_payments JSONB DEFAULT '[]'::JSONB,
  p_subtotal NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_discount_percentage NUMERIC DEFAULT 0,
  p_tax_amount NUMERIC DEFAULT 0,
  p_total_amount NUMERIC DEFAULT 0,
  p_amount_paid NUMERIC DEFAULT 0,
  p_change_amount NUMERIC DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  v_sale_number TEXT;
  v_shift_id UUID;
  v_item JSONB;
  v_payment JSONB;
  v_total_cost NUMERIC := 0;
  v_total_profit NUMERIC := 0;
  v_item_profit NUMERIC;
  v_result JSONB;
BEGIN
  -- Get active shift for the cashier
  SELECT id INTO v_shift_id
  FROM shifts
  WHERE user_id = p_cashier_id
    AND status = 'open'
  ORDER BY start_time DESC
  LIMIT 1;

  IF v_shift_id IS NULL THEN
    RAISE EXCEPTION 'No active shift found for cashier';
  END IF;

  -- Generate sale number
  v_sale_number := 'SALE-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || FLOOR(RANDOM() * 1000)::INT;

  -- Create the sale record
  INSERT INTO sales (
    sale_number,
    location_id,
    customer_id,
    cashier_id,
    shift_id,
    status,
    subtotal,
    discount_amount,
    discount_percentage,
    tax_amount,
    total_amount,
    amount_paid,
    change_amount,
    completed_at
  ) VALUES (
    v_sale_number,
    p_location_id,
    p_customer_id,
    p_cashier_id,
    v_shift_id,
    'completed',
    p_subtotal,
    p_discount_amount,
    p_discount_percentage,
    p_tax_amount,
    p_total_amount,
    p_amount_paid,
    p_change_amount,
    NOW()
  );

  -- Insert sale items and calculate profit
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_profit := (v_item->>'quantity')::NUMERIC * 
                     ((v_item->>'unit_price')::NUMERIC - (v_item->>'cost_price')::NUMERIC);
    v_total_cost := v_total_cost + ((v_item->>'quantity')::NUMERIC * (v_item->>'cost_price')::NUMERIC);
    v_total_profit := v_total_profit + v_item_profit;

    INSERT INTO sale_items (
      sale_id,
      product_id,
      variant_id,
      product_name,
      sku,
      quantity,
      unit_price,
      discount_amount,
      discount_percentage,
      tax_rate,
      tax_amount,
      line_total,
      cost_price,
      profit_amount
    ) VALUES (
      p_sale_id,
      (v_item->>'product_id')::UUID,
      NULLIF(v_item->>'variant_id', '')::UUID,
      v_item->>'product_name',
      v_item->>'sku',
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      COALESCE((v_item->>'discount_amount')::NUMERIC, 0),
      COALESCE((v_item->>'discount_percentage')::NUMERIC, 0),
      COALESCE((v_item->>'tax_rate')::NUMERIC, 0),
      COALESCE((v_item->>'tax_amount')::NUMERIC, 0),
      (v_item->>'line_total')::NUMERIC,
      (v_item->>'cost_price')::NUMERIC,
      v_item_profit
    );
  END LOOP;

  -- Update sale with cost and profit
  UPDATE sales
  SET total_cost = v_total_cost,
      total_profit = v_total_profit
  WHERE id = p_sale_id;

  -- Insert payments
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO payments (
      sale_id,
      payment_method_id,
      amount,
      reference_number,
      notes
    ) VALUES (
      p_sale_id,
      (v_payment->>'payment_method_id')::UUID,
      (v_payment->>'amount')::NUMERIC,
      v_payment->>'reference_number',
      v_payment->>'notes'
    );
  END LOOP;

  -- Update shift totals
  UPDATE shifts
  SET 
    total_sales = COALESCE(total_sales, 0) + p_total_amount,
    total_discounts = COALESCE(total_discounts, 0) + p_discount_amount,
    total_tax = COALESCE(total_tax, 0) + p_tax_amount,
    transaction_count = COALESCE(transaction_count, 0) + 1,
    updated_at = NOW()
  WHERE id = v_shift_id;

  -- Update customer stats if customer_id provided
  IF p_customer_id IS NOT NULL THEN
    UPDATE customers
    SET 
      total_spent = COALESCE(total_spent, 0) + p_total_amount,
      visit_count = COALESCE(visit_count, 0) + 1,
      last_visit_at = NOW(),
      updated_at = NOW()
    WHERE id = p_customer_id;
  END IF;

  v_result := jsonb_build_object(
    'sale_number', v_sale_number,
    'shift_id', v_shift_id,
    'total_profit', v_total_profit
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Create function to handle voided sales
CREATE OR REPLACE FUNCTION void_sale_update_shift()
RETURNS TRIGGER AS $$
DECLARE
  v_shift_id UUID;
BEGIN
  -- Only process if status changed to 'voided'
  IF NEW.status = 'voided' AND OLD.status != 'voided' THEN
    v_shift_id := NEW.shift_id;
    
    IF v_shift_id IS NOT NULL THEN
      -- Subtract from shift totals
      UPDATE shifts
      SET 
        total_sales = COALESCE(total_sales, 0) - OLD.total_amount,
        total_discounts = COALESCE(total_discounts, 0) - OLD.discount_amount,
        total_tax = COALESCE(total_tax, 0) - OLD.tax_amount,
        transaction_count = GREATEST(COALESCE(transaction_count, 0) - 1, 0),
        updated_at = NOW()
      WHERE id = v_shift_id;

      -- Subtract from payment method totals
      DECLARE
        v_payment RECORD;
      BEGIN
        FOR v_payment IN 
          SELECT p.amount, pm.code
          FROM payments p
          JOIN payment_methods pm ON p.payment_method_id = pm.id
          WHERE p.sale_id = NEW.id
        LOOP
          IF v_payment.code = 'cash' THEN
            UPDATE shifts
            SET total_cash_sales = COALESCE(total_cash_sales, 0) - OLD.total_amount,
                updated_at = NOW()
            WHERE id = v_shift_id;
          ELSIF v_payment.code IN ('card', 'pos') THEN
            UPDATE shifts
            SET total_card_sales = COALESCE(total_card_sales, 0) - OLD.total_amount,
                updated_at = NOW()
            WHERE id = v_shift_id;
          END IF;
        END LOOP;
      END;

      -- Subtract from customer stats if customer exists
      IF OLD.customer_id IS NOT NULL THEN
        UPDATE customers
        SET 
          total_spent = GREATEST(COALESCE(total_spent, 0) - OLD.total_amount, 0),
          visit_count = GREATEST(COALESCE(visit_count, 0) - 1, 0),
          updated_at = NOW()
        WHERE id = OLD.customer_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_void_sale_update_shift ON sales;
CREATE TRIGGER trigger_void_sale_update_shift
  AFTER UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION void_sale_update_shift();
