/*
  # Add is_default column to locations table

  1. Changes
    - Add `is_default` boolean column to locations table
    - Set existing location as default
    - Add constraint to ensure only one default location exists

  2. Notes
    - This allows the system to identify the primary location for inventory operations
*/

-- Add is_default column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locations' AND column_name = 'is_default'
  ) THEN
    ALTER TABLE locations ADD COLUMN is_default boolean DEFAULT false;
  END IF;
END $$;

-- Set the first location as default if no default exists
UPDATE locations
SET is_default = true
WHERE id = (
  SELECT id FROM locations
  ORDER BY created_at ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM locations WHERE is_default = true
);

-- Create unique partial index to ensure only one default location
CREATE UNIQUE INDEX IF NOT EXISTS locations_single_default_idx
ON locations (is_default)
WHERE is_default = true;