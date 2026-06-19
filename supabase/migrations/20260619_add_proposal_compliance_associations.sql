-- Associazioni tra proposte e documenti di conformità (collegate come i Documenti Commessa:
-- alla conversione in commessa vengono copiate in job_compliance_associations)
CREATE TABLE IF NOT EXISTS public.proposal_compliance_associations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_id uuid NOT NULL REFERENCES client_proposals(id) ON DELETE CASCADE,
    compliance_document_id uuid NOT NULL REFERENCES supplier_compliance_documents(id) ON DELETE CASCADE,
    custom_name text,
    custom_notes text,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    deleted_at timestamptz,
    UNIQUE (proposal_id, compliance_document_id)
);

ALTER TABLE public.proposal_compliance_associations ENABLE ROW LEVEL SECURITY;

-- USING (true): vedi nota in 20260618_add_job_compliance_associations.sql sul motivo
-- per cui la policy SELECT non deve filtrare su deleted_at.
CREATE POLICY "auth_select_proposal_compliance_associations"
    ON public.proposal_compliance_associations FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "auth_insert_proposal_compliance_associations"
    ON public.proposal_compliance_associations FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "auth_update_proposal_compliance_associations"
    ON public.proposal_compliance_associations FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_proposal_compliance_associations_proposal_id ON public.proposal_compliance_associations(proposal_id);
