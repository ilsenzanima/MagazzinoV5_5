-- Tipi per i documenti caricati direttamente nella tab Conformità di una commessa
-- (distinti dai "Documenti Conformità" fornitore usati per l'associazione).
CREATE TABLE job_conformita_document_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE job_conformita_document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read job conformita document types"
    ON job_conformita_document_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert job conformita document types"
    ON job_conformita_document_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update job conformita document types"
    ON job_conformita_document_types FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete job conformita document types"
    ON job_conformita_document_types FOR DELETE TO authenticated USING (true);

ALTER TABLE job_documents ADD COLUMN conformita_document_type_id uuid REFERENCES job_conformita_document_types(id) ON DELETE SET NULL;
CREATE INDEX idx_job_documents_conformita_document_type_id ON job_documents(conformita_document_type_id);
