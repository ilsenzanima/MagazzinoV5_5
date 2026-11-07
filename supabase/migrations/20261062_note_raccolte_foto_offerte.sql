-- Note delle raccolte di foto (la raccolta senza cartella di un tipo) anche per le offerte, come per le commesse.
CREATE TABLE IF NOT EXISTS public.proposal_site_type_notes (
  proposal_id uuid NOT NULL REFERENCES public.client_proposals(id) ON DELETE CASCADE,
  document_type_id uuid NOT NULL REFERENCES public.job_site_document_types(id) ON DELETE CASCADE,
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, document_type_id)
);

ALTER TABLE public.proposal_site_type_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read proposal_site_type_notes"
  ON public.proposal_site_type_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert proposal_site_type_notes"
  ON public.proposal_site_type_notes FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));
CREATE POLICY "Staff can update proposal_site_type_notes"
  ON public.proposal_site_type_notes FOR UPDATE TO authenticated
  USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));
CREATE POLICY "Staff can delete proposal_site_type_notes"
  ON public.proposal_site_type_notes FOR DELETE TO authenticated
  USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));
