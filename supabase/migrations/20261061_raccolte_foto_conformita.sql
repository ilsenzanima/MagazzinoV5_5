-- Raccolte foto anche per i documenti di Conformità Personalizzata.
ALTER TABLE public.job_conformita_document_types ADD COLUMN IF NOT EXISTS is_photo_gallery boolean NOT NULL DEFAULT false;

-- Note delle cartelle e delle raccolte senza cartella
ALTER TABLE public.job_document_folders ADD COLUMN IF NOT EXISTS notes text;

CREATE TABLE IF NOT EXISTS public.job_conformita_type_notes (
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  document_type_id uuid NOT NULL REFERENCES public.job_conformita_document_types(id) ON DELETE CASCADE,
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, document_type_id)
);

ALTER TABLE public.job_conformita_type_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read job_conformita_type_notes"
  ON public.job_conformita_type_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert job_conformita_type_notes"
  ON public.job_conformita_type_notes FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));
CREATE POLICY "Staff can update job_conformita_type_notes"
  ON public.job_conformita_type_notes FOR UPDATE TO authenticated
  USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));
CREATE POLICY "Staff can delete job_conformita_type_notes"
  ON public.job_conformita_type_notes FOR DELETE TO authenticated
  USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));
