-- Add supplier_code column to inventory table
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS supplier_code TEXT;

-- Update RLS policies if necessary (usually existing ones cover new columns if they are select *, which they typically are)
-- Existing policies on inventory are "Enable read access for authenticated users" and "Enable insert/update/delete for authenticated users" usually.
