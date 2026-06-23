-- Supplier groups (fatturazione condivisa): a "billing" supplier (the one
-- that actually issues the invoice) aggregates purchases registered under
-- two or more other real suppliers.
CREATE TABLE IF NOT EXISTS supplier_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    billing_supplier_id UUID NOT NULL UNIQUE REFERENCES suppliers(id) ON DELETE CASCADE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES profiles(id),
    deleted_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_group_members (
    group_id UUID NOT NULL REFERENCES supplier_groups(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_group_members_supplier_id ON supplier_group_members(supplier_id);

ALTER TABLE supplier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_groups_select" ON supplier_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "supplier_groups_insert" ON supplier_groups FOR INSERT TO authenticated WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operativo')
);
CREATE POLICY "supplier_groups_update" ON supplier_groups FOR UPDATE TO authenticated USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operativo')
);
CREATE POLICY "supplier_groups_delete" ON supplier_groups FOR DELETE TO authenticated USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "supplier_group_members_select" ON supplier_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "supplier_group_members_insert" ON supplier_group_members FOR INSERT TO authenticated WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operativo')
);
CREATE POLICY "supplier_group_members_delete" ON supplier_group_members FOR DELETE TO authenticated USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operativo')
);
