-- Cronoprogramma per offerte/proposte: fasi pianificate con durata in giorni lavorativi
-- (no date assolute: vengono calcolate alla conversione in commessa)
CREATE TABLE proposal_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id uuid NOT NULL REFERENCES client_proposals(id) ON DELETE CASCADE,
    name text NOT NULL,
    duration_days integer NOT NULL DEFAULT 1 CHECK (duration_days >= 1),
    sort_order integer NOT NULL DEFAULT 0,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_tasks_proposal_id ON proposal_tasks(proposal_id);

ALTER TABLE proposal_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read proposal tasks"
    ON proposal_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert proposal tasks"
    ON proposal_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update proposal tasks"
    ON proposal_tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete proposal tasks"
    ON proposal_tasks FOR DELETE TO authenticated USING (true);
