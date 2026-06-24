-- Unifica le offerte fornitori di proposte e commesse in un'unica tabella condivisa,
-- come già fatto per shared_documents: un'offerta caricata sulla proposta resta visibile
-- sulla commessa generata dalla conversione (e viceversa), senza copie separate.

CREATE TABLE shared_supplier_offers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id uuid REFERENCES client_proposals(id) ON DELETE CASCADE,
    job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
    name text NOT NULL,
    notes text,
    file_url text NOT NULL,
    file_type text,
    file_size bigint,
    uploaded_by uuid,
    uploaded_by_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT shared_supplier_offers_owner_check CHECK (proposal_id IS NOT NULL OR job_id IS NOT NULL)
);

CREATE INDEX idx_shared_supplier_offers_proposal_id ON shared_supplier_offers(proposal_id);
CREATE INDEX idx_shared_supplier_offers_job_id ON shared_supplier_offers(job_id);

ALTER TABLE shared_supplier_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated all supplier_offers" ON shared_supplier_offers
    FOR ALL TO authenticated
    USING ((select auth.uid()) IS NOT NULL)
    WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Migra le offerte fornitori già caricate sulle commesse (categoria "offerte-fornitori" in job_documents)
INSERT INTO shared_supplier_offers (job_id, name, notes, file_url, file_type, file_size, uploaded_by, created_at)
SELECT job_id, name, notes, file_url, file_type, file_size, uploaded_by, created_at
FROM job_documents
WHERE category = 'offerte-fornitori';

DELETE FROM job_documents WHERE category = 'offerte-fornitori';
