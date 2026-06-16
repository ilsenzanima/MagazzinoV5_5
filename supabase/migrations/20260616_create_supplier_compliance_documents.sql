-- Create supplier compliance documents table
CREATE TABLE IF NOT EXISTS supplier_compliance_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
    document_type TEXT NOT NULL CHECK (document_type IN ('RDC_RDV_FT', 'ETA', 'DOP', 'CONFORMITA_PRODUTTORE', 'OMOLOGAZIONE_MINISTERIALE')),
    name TEXT NOT NULL,
    notes TEXT,
    file_url TEXT NOT NULL,
    purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_compliance_docs_supplier ON supplier_compliance_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_brand ON supplier_compliance_documents(brand_id);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_purchase ON supplier_compliance_documents(purchase_id);

-- RLS
ALTER TABLE supplier_compliance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read compliance documents"
    ON supplier_compliance_documents FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert compliance documents"
    ON supplier_compliance_documents FOR INSERT
    TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update compliance documents"
    ON supplier_compliance_documents FOR UPDATE
    TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete compliance documents"
    ON supplier_compliance_documents FOR DELETE
    TO authenticated USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_compliance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER compliance_updated_at
    BEFORE UPDATE ON supplier_compliance_documents
    FOR EACH ROW EXECUTE FUNCTION update_compliance_updated_at();
