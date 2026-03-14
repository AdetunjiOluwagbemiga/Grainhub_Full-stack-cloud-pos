/*
  # Fix Authentication Security and Add Constraints

  1. Security Fixes
    - Modify RLS policy to prevent users from changing their own role
    - Restrict profile viewing to own profile only (admins can see all)
    - Add unique constraints on email and PIN code

  2. Data Integrity
    - Add unique constraint on user_profiles.email
    - Add unique constraint on user_profiles.pin_code (allows NULL)
    - Add check constraint on PIN format (4-6 digits)

  3. Updated Triggers
    - Add updated_at trigger for user_profiles
*/

-- Drop ALL existing RLS policies on user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles CASCADE;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles CASCADE;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles CASCADE;
DROP POLICY IF EXISTS "Users can update own profile (excluding role)" ON user_profiles CASCADE;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles CASCADE;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles CASCADE;
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles CASCADE;
DROP POLICY IF EXISTS "Users can manage own profile" ON user_profiles CASCADE;

-- Create NEW restrictive RLS policies
CREATE POLICY "view_own_profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "admins_view_all_profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "update_own_profile_no_role_change"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND role = (SELECT role FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "admins_update_any_profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "admins_insert_profiles"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid())
  );

-- Add unique constraint on email (drop existing if any)
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_email_key;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_email_key UNIQUE (email);

-- Add unique constraint on PIN code (allows NULL, drop existing if any)
DROP INDEX IF EXISTS user_profiles_pin_code_key;
CREATE UNIQUE INDEX user_profiles_pin_code_key ON user_profiles (pin_code) WHERE pin_code IS NOT NULL;

-- Add check constraint for PIN format (4-6 digits)
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_pin_code_format;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_pin_code_format 
  CHECK (pin_code IS NULL OR pin_code ~ '^[0-9]{4,6}$');

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_profiles_updated_at ON user_profiles;

CREATE TRIGGER trigger_update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();
