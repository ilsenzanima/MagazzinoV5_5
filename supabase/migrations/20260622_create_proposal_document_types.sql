-- Tipi di documento configurabili per le proposte/offerte
CREATE TABLE IF NOT EXISTS proposal_document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE proposal_document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read proposal document types"
    ON proposal_document_types FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert proposal document types"
    ON proposal_document_types FOR INSERT
    TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update proposal document types"
    ON proposal_document_types FOR UPDATE
    TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete proposal document types"
    ON proposal_document_types FOR DELETE
    TO authenticated USING (true);

-- Collega i documenti proposta al tipo
ALTER TABLE proposal_documents
    ADD COLUMN IF NOT EXISTS document_type_id UUID REFERENCES proposal_document_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proposal_documents_type ON proposal_documents(document_type_id);
