-- Add number_int column to delivery_notes for proper numerical sorting
-- It extracts the first number found in the string and stores it as an integer
-- e.g., '1/PP26' -> 1, '10/PP26' -> 10

ALTER TABLE delivery_notes 
ADD COLUMN IF NOT EXISTS number_int integer 
GENERATED ALWAYS AS (substring(number from '^(\d+)')::integer) STORED;

-- Add index for performance on sorting
CREATE INDEX IF NOT EXISTS delivery_notes_number_int_idx ON delivery_notes(number_int);
