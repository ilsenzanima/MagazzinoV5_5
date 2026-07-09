-- ── 1. Policy per job_documents (Conformità Personalizzata) ──────────────────
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON public.job_documents;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON public.job_documents;
DROP POLICY IF EXISTS "Authenticated users can upload documents." ON public.job_documents;
DROP POLICY IF EXISTS "Authenticated users can read compliance documents" ON public.job_documents;

-- SELECT: tutti gli autenticati possono leggere
CREATE POLICY "job_documents_select" ON public.job_documents
    FOR SELECT TO authenticated USING (true);

-- INSERT: admin e operativo
CREATE POLICY "job_documents_insert" ON public.job_documents
    FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));

-- UPDATE: admin e operativo (risolve il blocco dell'assegnazione tipo)
CREATE POLICY "job_documents_update" ON public.job_documents
    FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));

-- DELETE: admin e operativo (cancella in sicurezza dal DB)
CREATE POLICY "job_documents_delete" ON public.job_documents
    FOR DELETE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));


-- ── 2. Policy per shared_site_documents (Documenti Cantiere) ─────────────────
DROP POLICY IF EXISTS "authenticated all site_docs" ON public.shared_site_documents;

-- SELECT: tutti gli autenticati
CREATE POLICY "shared_site_documents_select" ON public.shared_site_documents
    FOR SELECT TO authenticated USING (true);

-- INSERT: admin e operativo
CREATE POLICY "shared_site_documents_insert" ON public.shared_site_documents
    FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));

-- UPDATE: admin e operativo
CREATE POLICY "shared_site_documents_update" ON public.shared_site_documents
    FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));

-- DELETE: admin e operativo
CREATE POLICY "shared_site_documents_delete" ON public.shared_site_documents
    FOR DELETE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));


-- ── 3. Policy per shared_documents (Documenti Commessa/Offerta) ───────────────
DROP POLICY IF EXISTS "authenticated all prop_docs" ON public.shared_documents;

-- SELECT: tutti gli autenticati
CREATE POLICY "shared_documents_select" ON public.shared_documents
    FOR SELECT TO authenticated USING (true);

-- INSERT: admin e operativo
CREATE POLICY "shared_documents_insert" ON public.shared_documents
    FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));

-- UPDATE: admin e operativo
CREATE POLICY "shared_documents_update" ON public.shared_documents
    FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));

-- DELETE: admin e operativo
CREATE POLICY "shared_documents_delete" ON public.shared_documents
    FOR DELETE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
