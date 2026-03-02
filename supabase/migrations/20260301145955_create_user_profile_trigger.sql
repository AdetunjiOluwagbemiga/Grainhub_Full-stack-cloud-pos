/*
  # Auto-create User Profile on Signup

  ## Problem
  When users sign up through Supabase Auth, a record is created in `auth.users` but NOT in `user_profiles`.
  This causes the app to fail loading the user's role, defaulting to cashier permissions.

  ## Solution
  1. Create a trigger function that automatically creates a profile when a user signs up
  2. Set the first user as admin, subsequent users as cashier by default
  3. Create trigger on auth.users table

  ## Security
  - Function runs with SECURITY DEFINER to bypass RLS
  - Only creates profile if one doesn't exist
  - First user gets admin role, others get cashier
*/

-- Function to create user profile automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_count integer;
BEGIN
  -- Check if this is the first user
  SELECT COUNT(*) INTO user_count FROM public.user_profiles;
  
  -- Insert new profile
  INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE 
      WHEN user_count = 0 THEN 'admin'::user_role
      ELSE 'cashier'::user_role
    END,
    true
  );
  
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create profile for any existing users that don't have one
DO $$
DECLARE
  user_record RECORD;
  user_count integer;
BEGIN
  FOR user_record IN 
    SELECT id, email, raw_user_meta_data
    FROM auth.users
    WHERE id NOT IN (SELECT id FROM public.user_profiles)
  LOOP
    -- Check current profile count for each user
    SELECT COUNT(*) INTO user_count FROM public.user_profiles;
    
    INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
    VALUES (
      user_record.id,
      user_record.email,
      COALESCE(user_record.raw_user_meta_data->>'full_name', split_part(user_record.email, '@', 1)),
      CASE 
        WHEN user_count = 0 THEN 'admin'::user_role
        ELSE 'cashier'::user_role
      END,
      true
    );
  END LOOP;
END $$;