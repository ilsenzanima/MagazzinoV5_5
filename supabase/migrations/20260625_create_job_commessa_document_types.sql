-- Tipi di documento configurabili per i documenti commessa (stesso pattern delle proposte)
CREATE TABLE IF NOT EXISTS job_commessa_document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE job_commessa_document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read job commessa document types"
    ON job_commessa_document_types FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert job commessa document types"
    ON job_commessa_document_types FOR INSERT
    TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update job commessa document types"
    ON job_commessa_document_types FOR UPDATE
    TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete job commessa document types"
    ON job_commessa_document_types FOR DELETE
    TO authenticated USING (true);

-- Collega i documenti commessa al tipo e aggiunge la dimensione file (come nelle proposte)
ALTER TABLE job_commessa_documents
    ADD COLUMN IF NOT EXISTS document_type_id UUID REFERENCES job_commessa_document_types(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS file_size BIGINT;

CREATE INDEX IF NOT EXISTS idx_job_commessa_documents_type ON job_commessa_documents(document_type_id);
