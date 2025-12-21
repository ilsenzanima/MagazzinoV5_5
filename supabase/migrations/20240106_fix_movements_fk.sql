-- Fix FKs for movements, job_logs, and job_documents to reference profiles instead of auth.users
-- This allows PostgREST to resolve profiles:user_id relationships

-- 1. Movements
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'movements_user_id_fkey'
        AND table_name = 'movements'
    ) THEN
        ALTER TABLE public.movements DROP CONSTRAINT movements_user_id_fkey;
    END IF;
END $$;

ALTER TABLE public.movements
    ADD CONSTRAINT movements_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- 2. Job Logs
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'job_logs_user_id_fkey'
        AND table_name = 'job_logs'
    ) THEN
        ALTER TABLE public.job_logs DROP CONSTRAINT job_logs_user_id_fkey;
    END IF;
END $$;

ALTER TABLE public.job_logs
    ADD CONSTRAINT job_logs_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- 3. Job Documents
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'job_documents_uploaded_by_fkey'
        AND table_name = 'job_documents'
    ) THEN
        ALTER TABLE public.job_documents DROP CONSTRAINT job_documents_uploaded_by_fkey;
    END IF;
END $$;

ALTER TABLE public.job_documents
    ADD CONSTRAINT job_documents_uploaded_by_fkey
    FOREIGN KEY (uploaded_by)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
