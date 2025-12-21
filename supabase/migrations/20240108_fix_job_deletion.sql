-- Fix FK for movements to cascade delete when job is deleted
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'movements_job_id_fkey'
        AND table_name = 'movements'
    ) THEN
        ALTER TABLE public.movements DROP CONSTRAINT movements_job_id_fkey;
    END IF;
END $$;

ALTER TABLE public.movements
    ADD CONSTRAINT movements_job_id_fkey
    FOREIGN KEY (job_id)
    REFERENCES public.jobs(id)
    ON DELETE CASCADE;
