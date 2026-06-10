-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    document_urls TEXT[] DEFAULT '{}',
    total_amount NUMERIC(12,2) DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add invoice_id to purchases (nullable FK)
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_id ON invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_invoice_id ON purchases(invoice_id);

-- RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select" ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoices_insert" ON invoices FOR INSERT TO authenticated WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operativo')
);
CREATE POLICY "invoices_update" ON invoices FOR UPDATE TO authenticated USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operativo')
);
CREATE POLICY "invoices_delete" ON invoices FOR DELETE TO authenticated USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
