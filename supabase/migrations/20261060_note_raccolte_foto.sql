-- Note delle raccolte di foto: una per ogni cartella e una per ogni tipo (la raccolta senza cartella) di una commessa.
ALTER TABLE public.job_site_document_folders ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.proposal_document_folders ADD COLUMN IF NOT EXISTS notes text;

CREATE TABLE IF NOT EXISTS public.job_site_type_notes (
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  document_type_id uuid NOT NULL REFERENCES public.job_site_document_types(id) ON DELETE CASCADE,
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, document_type_id)
);

ALTER TABLE public.job_site_type_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read job_site_type_notes"
  ON public.job_site_type_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert job_site_type_notes"
  ON public.job_site_type_notes FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));
CREATE POLICY "Staff can update job_site_type_notes"
  ON public.job_site_type_notes FOR UPDATE TO authenticated
  USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));
CREATE POLICY "Staff can delete job_site_type_notes"
  ON public.job_site_type_notes FOR DELETE TO authenticated
  USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));
