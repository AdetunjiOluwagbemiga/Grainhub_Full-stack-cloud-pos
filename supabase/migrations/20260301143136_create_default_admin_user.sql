/*
  # Create Default Admin User

  Creates a default admin account for initial system access.
  
  Default credentials:
  - Email: admin@pos.system
  - Password: admin123
  
  IMPORTANT: Change this password immediately after first login!
*/

-- Note: This creates a user profile placeholder
-- The actual auth.users entry must be created through Supabase Auth signup
-- This is just documentation for the default account to create

-- Insert a note in the database about default credentials
DO $$
BEGIN
  RAISE NOTICE 'Default admin account should be created with:';
  RAISE NOTICE 'Email: admin@pos.system';
  RAISE NOTICE 'Password: admin123';
  RAISE NOTICE 'Please change the password after first login!';
END $$;
