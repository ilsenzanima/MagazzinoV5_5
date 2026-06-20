-- Documenti Cantiere: aggiunta colonna note (form uniforme con proposte)
ALTER TABLE public.job_documents ADD COLUMN IF NOT EXISTS notes text;

-- Documenti Commessa: visibili solo ad admin/operativo, popolati anche dalla conversione proposta -> commessa
CREATE TABLE IF NOT EXISTS public.job_commessa_documents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    name text NOT NULL,
    notes text,
    file_url text NOT NULL,
    file_type text,
    uploaded_by uuid REFERENCES auth.users(id),
    uploaded_by_name text,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.job_commessa_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_job_commessa_documents" ON public.job_commessa_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_job_commessa_documents" ON public.job_commessa_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_job_commessa_documents" ON public.job_commessa_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_job_commessa_documents" ON public.job_commessa_documents FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_job_commessa_documents_job_id ON public.job_commessa_documents(job_id);
