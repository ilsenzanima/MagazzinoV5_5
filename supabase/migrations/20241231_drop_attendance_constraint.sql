-- First, check if the constraint exists
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'attendance' 
AND constraint_type = 'UNIQUE';

-- Then drop it with the exact name
ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS attendance_worker_id_date_key;

-- Verify it's gone
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'attendance' 
AND constraint_type = 'UNIQUE';
