-- Create worker_courses table for tracking training courses
CREATE TABLE IF NOT EXISTS public.worker_courses (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    course_name text NOT NULL,
    completion_date date NOT NULL,
    validity_years integer NOT NULL DEFAULT 1,
    created_at timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL
);

-- Create index for faster lookups by worker
CREATE INDEX idx_worker_courses_worker_id ON public.worker_courses(worker_id);

-- Add course_id column to attendance table for tracking which course was attended
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.worker_courses(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.worker_courses ENABLE ROW LEVEL SECURITY;

-- RLS Policies (same as workers table - authenticated users can access)
CREATE POLICY "Allow authenticated read" ON public.worker_courses
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON public.worker_courses
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON public.worker_courses
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated delete" ON public.worker_courses
    FOR DELETE TO authenticated USING (true);
