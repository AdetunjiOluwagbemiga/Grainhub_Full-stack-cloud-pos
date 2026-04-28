/*
  # Fix user deletion FK constraints

  ## Problem
  Permanently deleting a user fails because `sales.cashier_id` and `refunds.refunded_by`
  have RESTRICT delete rules, preventing deletion of any user who has processed sales or refunds.

  ## Changes
  1. `sales.cashier_id` - changed from RESTRICT to SET NULL
     Sales history is preserved; cashier reference becomes NULL when user is deleted.
  2. `refunds.refunded_by` - changed from RESTRICT to SET NULL
     Refund history is preserved; refunded_by reference becomes NULL when user is deleted.

  ## Notes
  - No data is lost; sales and refund records remain intact
  - Only the reference to the deleted user is cleared (set to NULL)
  - This allows permanent user deletion while preserving transaction history
*/

ALTER TABLE sales
  DROP CONSTRAINT IF EXISTS sales_cashier_id_fkey;

ALTER TABLE sales
  ADD CONSTRAINT sales_cashier_id_fkey
  FOREIGN KEY (cashier_id)
  REFERENCES user_profiles(id)
  ON DELETE SET NULL;

ALTER TABLE refunds
  DROP CONSTRAINT IF EXISTS refunds_refunded_by_fkey;

ALTER TABLE refunds
  ADD CONSTRAINT refunds_refunded_by_fkey
  FOREIGN KEY (refunded_by)
  REFERENCES user_profiles(id)
  ON DELETE SET NULL;
