-- Update attendance status check constraint to include medical_exam
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;

ALTER TABLE public.attendance ADD CONSTRAINT attendance_status_check 
CHECK (status IN ('presence', 'absence', 'sick', 'holiday', 'permit', 'injury', 'transfer', 'course', 'strike', 'medical_exam'));
