/*
  # Fix User Profiles Update Policy for Admins

  ## Problem
  The admin update policy for user_profiles table is missing, preventing admins from updating user roles and account statuses.

  ## Solution
  Add the missing admin update policy that allows admins to update all user profiles including:
  - role changes
  - account_status approvals/rejections
  - other profile fields

  ## Security
  - Only users with admin role can update any user profile
  - Uses the is_admin() function to check permissions
*/

-- Drop old conflicting policies if they exist
DROP POLICY IF EXISTS "Admins can update profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;

-- Create the admin update policy
CREATE POLICY "admins_can_update_all_profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );
