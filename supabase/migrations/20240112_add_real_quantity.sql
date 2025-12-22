-- Add real_quantity column to inventory table for audit purposes
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS real_quantity NUMERIC DEFAULT NULL;
