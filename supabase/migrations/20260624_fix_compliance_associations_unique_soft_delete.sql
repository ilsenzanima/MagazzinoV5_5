-- Il vincolo UNIQUE(job_id, compliance_document_id) non teneva conto del soft delete:
-- quando una commessa viene cancellata (soft delete) e poi rigenerata riusando lo stesso
-- job_id, una nuova associazione allo stesso documento andava in conflitto (409) con il
-- vecchio record soft-deleted. Sostituito con un indice unico parziale solo sulle righe attive.

ALTER TABLE job_compliance_associations DROP CONSTRAINT IF EXISTS job_compliance_associations_job_id_compliance_document_id_key;
DROP INDEX IF EXISTS job_compliance_associations_job_id_compliance_document_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS job_compliance_associations_active_unique
    ON job_compliance_associations (job_id, compliance_document_id)
    WHERE deleted_at IS NULL;

ALTER TABLE proposal_compliance_associations DROP CONSTRAINT IF EXISTS proposal_compliance_associations_proposal_id_compliance_document_id_key;
DROP INDEX IF EXISTS proposal_compliance_associations_proposal_id_compliance_document_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS proposal_compliance_associations_active_unique
    ON proposal_compliance_associations (proposal_id, compliance_document_id)
    WHERE deleted_at IS NULL;
