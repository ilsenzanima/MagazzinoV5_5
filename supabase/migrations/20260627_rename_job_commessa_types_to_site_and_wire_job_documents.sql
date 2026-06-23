-- "Documenti Commessa" condivide i record con le proposte (shared_documents),
-- quindi i suoi tipi devono essere quelli di proposal_document_types, non una lista propria.
-- La lista creata per errore come "tipi commessa" diventa invece quella per i
-- documenti di cantiere (job_documents), che finora non avevano categorizzazione.

ALTER TABLE shared_documents DROP COLUMN IF EXISTS job_document_type_id;

ALTER TABLE job_commessa_document_types RENAME TO job_site_document_types;

ALTER TABLE job_documents ADD COLUMN document_type_id uuid REFERENCES job_site_document_types(id) ON DELETE SET NULL;
ALTER TABLE job_documents ADD COLUMN file_size bigint;

CREATE INDEX IF NOT EXISTS idx_job_documents_document_type_id ON job_documents(document_type_id);
