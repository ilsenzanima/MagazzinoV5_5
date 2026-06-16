-- Fix RLS, soft delete e security advisor per supplier_compliance_documents

-- ── 1. Soft delete columns ───────────────────────────────────────────────────
ALTER TABLE public.supplier_compliance_documents
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by_name TEXT DEFAULT NULL;

-- ── 2. Drop vecchie policy permissive ───────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read compliance documents" ON public.supplier_compliance_documents;
DROP POLICY IF EXISTS "Authenticated users can insert compliance documents" ON public.supplier_compliance_documents;
DROP POLICY IF EXISTS "Authenticated users can update compliance documents" ON public.supplier_compliance_documents;
DROP POLICY IF EXISTS "Authenticated users can delete compliance documents" ON public.supplier_compliance_documents;

-- ── 3. Nuove policy con controllo ruolo ─────────────────────────────────────
-- SELECT: admin e operativo vedono tutto (incluso soft-deleted per admin), user non vede nulla
CREATE POLICY "Compliance docs readable by Admin/Operativo"
    ON public.supplier_compliance_documents FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() IN ('admin', 'operativo')
        AND deleted_at IS NULL
    );

-- L'admin può vedere anche i soft-deleted (per eventuale cestino futuro)
CREATE POLICY "Compliance docs deleted readable by Admin"
    ON public.supplier_compliance_documents FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'admin'
        AND deleted_at IS NOT NULL
    );

-- INSERT: admin e operativo
CREATE POLICY "Compliance docs insert by Admin/Operativo"
    ON public.supplier_compliance_documents FOR INSERT
    TO authenticated
    WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));

-- UPDATE: admin e operativo (soft delete = update del deleted_at)
CREATE POLICY "Compliance docs update by Admin/Operativo"
    ON public.supplier_compliance_documents FOR UPDATE
    TO authenticated
    USING (public.get_my_role() IN ('admin', 'operativo'));

-- DELETE hard: solo admin (non usato normalmente, il soft delete usa UPDATE)
CREATE POLICY "Compliance docs hard delete by Admin only"
    ON public.supplier_compliance_documents FOR DELETE
    TO authenticated
    USING (public.get_my_role() = 'admin');

-- ── 4. Fix trigger function (security advisor: set search_path) ──────────────
CREATE OR REPLACE FUNCTION public.update_compliance_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ── 5. Index su deleted_at per performance ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_compliance_docs_deleted_at
    ON public.supplier_compliance_documents(deleted_at)
    WHERE deleted_at IS NULL;
