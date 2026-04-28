/*
  # Fix FK constraints blocking auth user deletion

  ## Problem
  Permanently deleting a user from auth fails with "Database error deleting user"
  because these tables have RESTRICT/NO ACTION foreign keys pointing directly at auth.users:

  - public.shifts.user_id → auth.users.id (RESTRICT)
  - public.stock_movements.created_by → auth.users.id (RESTRICT)
  - public.audit_logs.user_id → auth.users.id (NO ACTION)

  ## Changes
  All three constraints changed to SET NULL so records are preserved but the
  reference to the deleted auth user is cleared automatically.
*/

ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_user_id_fkey;

ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_created_by_fkey;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;
