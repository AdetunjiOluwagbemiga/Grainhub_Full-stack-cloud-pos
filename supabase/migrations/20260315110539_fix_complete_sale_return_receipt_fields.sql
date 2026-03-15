/*
  # Fix Complete Sale Function - Return All Receipt Fields

  1. Issue
    - The complete_sale RPC function only returns: sale_number, shift_id, total_profit
    - Receipt generation requires: subtotal, discount_amount, tax_amount, amount_paid, change_amount, created_at
    - This causes "NaN" values in printed/downloaded receipts

  2. Changes
    - Update complete_sale function to return all fields needed for receipt generation
    - Return complete sale data including:
      - sale_number
      - created_at
      - subtotal
      - discount_amount
      - tax_amount
      - total_amount
      - amount_paid
      - change_amount
      - shift_id
      - total_profit

  3. Security
    - No security changes, maintains existing RLS policies
*/

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
  v_created_at TIMESTAMPTZ;
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
  v_created_at := NOW();

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
    v_created_at
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

  -- Return complete sale data for receipt generation
  v_result := jsonb_build_object(
    'sale_number', v_sale_number,
    'created_at', v_created_at,
    'subtotal', p_subtotal,
    'discount_amount', p_discount_amount,
    'tax_amount', p_tax_amount,
    'total_amount', p_total_amount,
    'amount_paid', p_amount_paid,
    'change_amount', p_change_amount,
    'shift_id', v_shift_id,
    'total_profit', v_total_profit
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;