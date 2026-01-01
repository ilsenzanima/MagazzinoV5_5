-- Add warehouse_id column to attendance table
ALTER TABLE public.attendance 
ADD COLUMN warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;

-- Add index for warehouse_id
CREATE INDEX idx_attendance_warehouse_id ON public.attendance(warehouse_id);

-- Add check constraint: either job_id or warehouse_id should be set for presence/transfer
-- (but not both, and not required for other statuses)
ALTER TABLE public.attendance
ADD CONSTRAINT attendance_job_or_warehouse_check 
CHECK (
    status NOT IN ('presence', 'transfer') 
    OR (job_id IS NOT NULL AND warehouse_id IS NULL)
    OR (job_id IS NULL AND warehouse_id IS NOT NULL)
    OR (job_id IS NULL AND warehouse_id IS NULL)
);
