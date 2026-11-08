-- Agenda: appuntamenti, scadenze, consegne, visite mediche, corsi, ferie/permessi e note (solo admin e operativi)
CREATE TABLE IF NOT EXISTS public.agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'appuntamento' CHECK (kind IN ('appuntamento','scadenza','consegna','visita','corso','permesso','nota')),
  date date NOT NULL,
  time time,
  end_date date,
  location text,
  notes text,
  worker_id uuid REFERENCES public.workers(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  remind_days_before integer NOT NULL DEFAULT 1 CHECK (remind_days_before >= 0),
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agenda_items_date_idx ON public.agenda_items (done, date);
ALTER TABLE public.agenda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read agenda_items" ON public.agenda_items FOR SELECT TO authenticated
  USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));
CREATE POLICY "Staff can insert agenda_items" ON public.agenda_items FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));
CREATE POLICY "Staff can update agenda_items" ON public.agenda_items FOR UPDATE TO authenticated
  USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));
CREATE POLICY "Staff can delete agenda_items" ON public.agenda_items FOR DELETE TO authenticated
  USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));
