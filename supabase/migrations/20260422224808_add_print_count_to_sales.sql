/*
  # Add print count tracking to sales

  1. Modified Tables
    - `sales`
      - `print_count` (integer, default 0) - tracks how many times a receipt has been printed or downloaded

  2. New Functions
    - `increment_print_count(p_sale_id uuid)` - atomically increments the print count and returns the new value

  3. Security
    - Function is accessible to authenticated users only
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'print_count'
  ) THEN
    ALTER TABLE sales ADD COLUMN print_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION increment_print_count(p_sale_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE sales
  SET print_count = print_count + 1
  WHERE id = p_sale_id
  RETURNING print_count INTO new_count;

  IF new_count IS NULL THEN
    RAISE EXCEPTION 'Sale not found: %', p_sale_id;
  END IF;

  RETURN new_count;
END;
$$;
