-- Unifica i documenti di proposte e commesse in un'unica tabella condivisa,
-- cosi un documento caricato su una proposta resta visibile sulla commessa
-- generata dalla conversione (e viceversa), senza copie separate.

ALTER TABLE proposal_documents RENAME TO shared_documents;
ALTER TABLE shared_documents RENAME COLUMN document_type_id TO proposal_document_type_id;
ALTER TABLE shared_documents ALTER COLUMN proposal_id DROP NOT NULL;
ALTER TABLE shared_documents ADD COLUMN job_id uuid REFERENCES jobs(id) ON DELETE CASCADE;
ALTER TABLE shared_documents ADD COLUMN job_document_type_id uuid REFERENCES job_commessa_document_types(id) ON DELETE SET NULL;
ALTER TABLE shared_documents ADD CONSTRAINT shared_documents_owner_check CHECK (proposal_id IS NOT NULL OR job_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_shared_documents_job_id ON shared_documents(job_id);
CREATE INDEX IF NOT EXISTS idx_shared_documents_job_document_type ON shared_documents(job_document_type_id);
CREATE INDEX IF NOT EXISTS idx_shared_documents_proposal_document_type ON shared_documents(proposal_document_type_id);

-- Migra i documenti commessa esistenti nella tabella unificata
INSERT INTO shared_documents (job_id, job_document_type_id, name, notes, file_url, file_type, file_size, uploaded_by, uploaded_by_name, created_at)
SELECT job_id, document_type_id, name, notes, file_url, file_type, file_size, uploaded_by::text, uploaded_by_name, created_at
FROM job_commessa_documents;

DROP TABLE job_commessa_documents;

-- Collega ai job_id corrispondenti i documenti delle proposte già convertite in commessa
UPDATE shared_documents sd
SET job_id = cp.converted_job_id
FROM client_proposals cp
WHERE cp.id = sd.proposal_id
  AND cp.converted_job_id IS NOT NULL
  AND sd.job_id IS NULL;
