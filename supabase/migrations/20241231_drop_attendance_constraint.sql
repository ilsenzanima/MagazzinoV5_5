-- Drop the unique constraint to allow multiple attendance records per worker per day
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_worker_id_date_key;
