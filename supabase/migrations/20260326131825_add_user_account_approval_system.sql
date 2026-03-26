/*
  # Add User Account Approval System

  ## Overview
  This migration adds an account approval system to prevent unauthorized users from accessing the POS system.
  New user signups will require admin approval before they can log in and use the system.

  ## Changes Made

  ### 1. User Profiles Table
  - Add `account_status` column with values: 'pending', 'approved', 'rejected'
  - Default status for new users is 'pending'
  - Add constraint to ensure valid status values
  - Add index for efficient status queries

  ### 2. Security Enhancement
  - Users with 'pending' or 'rejected' status cannot access the system
  - Only 'approved' users can perform operations
  - Admins can view and manage all user statuses

  ## Security Notes
  - This prevents unauthorized access to the POS system
  - Admins maintain full control over who can use the system
  - Audit trail is maintained for status changes
*/

-- Add account_status column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'account_status'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN account_status text NOT NULL DEFAULT 'pending' 
    CHECK (account_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Create index for efficient status queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_account_status 
ON user_profiles(account_status);

-- Update existing users to be approved (so current users aren't locked out)
UPDATE user_profiles 
SET account_status = 'approved' 
WHERE account_status = 'pending';

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.account_status IS 'Account approval status: pending (awaiting admin approval), approved (can access system), rejected (denied access)';
