-- Add new status values to attendance table
ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS attendance_status_check;

ALTER TABLE public.attendance 
ADD CONSTRAINT attendance_status_check 
CHECK (status IN ('presence', 'absence', 'sick', 'holiday', 'permit', 'strike', 'injury', 'transfer', 'course'));
