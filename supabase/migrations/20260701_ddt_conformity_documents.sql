-- Make brand_id nullable in supplier_compliance_documents so docs can be created
-- from the DDT page without requiring a brand selection
ALTER TABLE supplier_compliance_documents
    ALTER COLUMN brand_id DROP NOT NULL;

-- Junction table linking a purchase (DDT) to existing compliance documents
-- (mirrors the job_compliance_associations pattern)
CREATE TABLE IF NOT EXISTS purchase_compliance_associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    compliance_document_id UUID NOT NULL REFERENCES supplier_compliance_documents(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (purchase_id, compliance_document_id)
);

CREATE INDEX IF NOT EXISTS idx_pca_purchase ON purchase_compliance_associations(purchase_id);
CREATE INDEX IF NOT EXISTS idx_pca_doc ON purchase_compliance_associations(compliance_document_id);

ALTER TABLE purchase_compliance_associations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read purchase_compliance_associations"
    ON purchase_compliance_associations FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert purchase_compliance_associations"
    ON purchase_compliance_associations FOR INSERT
    TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update purchase_compliance_associations"
    ON purchase_compliance_associations FOR UPDATE
    TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete purchase_compliance_associations"
    ON purchase_compliance_associations FOR DELETE
    TO authenticated USING (true);
