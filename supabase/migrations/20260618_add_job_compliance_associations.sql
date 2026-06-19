-- Associazioni tra commesse e documenti di conformità
CREATE TABLE IF NOT EXISTS job_compliance_associations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    compliance_document_id uuid NOT NULL REFERENCES supplier_compliance_documents(id) ON DELETE CASCADE,
    custom_name text,
    custom_notes text,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    deleted_at timestamptz,
    UNIQUE (job_id, compliance_document_id)
);

ALTER TABLE job_compliance_associations ENABLE ROW LEVEL SECURITY;

-- USING (true): il filtro su deleted_at va fatto a livello applicativo. Una policy
-- SELECT che esclude le righe soft-deleted causa un errore RLS quando un UPDATE
-- imposta deleted_at, perché PostgREST richiede return=representation di default
-- e la riga aggiornata non sarebbe piu visibile secondo la policy.
CREATE POLICY "auth_select_job_compliance_associations"
    ON job_compliance_associations FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "auth_insert_job_compliance_associations"
    ON job_compliance_associations FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "auth_update_job_compliance_associations"
    ON job_compliance_associations FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);

-- Documenti di conformità propri della commessa (caricati direttamente)
-- Utilizziamo job_documents con category = 'conformita'
-- (nessuna nuova tabella necessaria)
