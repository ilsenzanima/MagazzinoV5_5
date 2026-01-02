-- Create worker_medical_exams table for tracking periodic work medical exams
CREATE TABLE IF NOT EXISTS public.worker_medical_exams (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    exam_date date NOT NULL,
    next_exam_date date NOT NULL, -- Typically 6 months after exam_date
    doctor_name text,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL
);

-- Create index for faster lookups by worker
CREATE INDEX idx_worker_medical_exams_worker_id ON public.worker_medical_exams(worker_id);

-- Enable RLS
ALTER TABLE public.worker_medical_exams ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated read" ON public.worker_medical_exams
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON public.worker_medical_exams
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON public.worker_medical_exams
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated delete" ON public.worker_medical_exams
    FOR DELETE TO authenticated USING (true);
