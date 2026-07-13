-- Analisi costi fornite da terzi e caricate come documento (a differenza di
-- quelle create nell'app in job_cost_analysis_rows/proposal_cost_analysis_rows).
-- Stessa tabella condivisa proposta/commessa di shared_supplier_offers: un
-- documento caricato sulla proposta resta visibile sulla commessa generata
-- dalla conversione (e viceversa), senza copie separate.

CREATE TABLE shared_cost_analysis_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id uuid REFERENCES client_proposals(id) ON DELETE SET NULL,
    job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
    name text NOT NULL,
    notes text,
    file_url text NOT NULL,
    file_type text,
    file_size bigint,
    uploaded_by uuid,
    uploaded_by_name text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shared_cost_analysis_documents_proposal_id ON shared_cost_analysis_documents(proposal_id);
CREATE INDEX idx_shared_cost_analysis_documents_job_id ON shared_cost_analysis_documents(job_id);

ALTER TABLE shared_cost_analysis_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated all cost_analysis_documents" ON shared_cost_analysis_documents
    FOR ALL TO authenticated
    USING ((select auth.uid()) IS NOT NULL)
    WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Riusa la funzione già introdotta per le altre tabelle condivise: elimina la
-- riga quando sia proposal_id sia job_id diventano NULL (riga orfana).
CREATE TRIGGER trg_delete_orphaned_shared_cost_analysis_documents
    AFTER UPDATE OF proposal_id, job_id ON shared_cost_analysis_documents
    FOR EACH ROW EXECUTE FUNCTION public.delete_orphaned_shared_row();
