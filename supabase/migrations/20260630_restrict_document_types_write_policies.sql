-- Le policy di scrittura (INSERT/UPDATE/DELETE) su queste tabelle di configurazione documenti
-- erano impostate con USING/WITH CHECK (true), quindi senza alcuna restrizione di ruolo.
-- Le restringiamo ad admin/operativo, in linea con le altre tabelle di configurazione del progetto.

-- compliance_document_types
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.compliance_document_types;
CREATE POLICY "Allow authenticated insert" ON public.compliance_document_types
    FOR INSERT TO authenticated
    WITH CHECK (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));

DROP POLICY IF EXISTS "Allow authenticated update" ON public.compliance_document_types;
CREATE POLICY "Allow authenticated update" ON public.compliance_document_types
    FOR UPDATE TO authenticated
    USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));

DROP POLICY IF EXISTS "Allow authenticated delete" ON public.compliance_document_types;
CREATE POLICY "Allow authenticated delete" ON public.compliance_document_types
    FOR DELETE TO authenticated
    USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));

-- job_conformita_document_types
DROP POLICY IF EXISTS "Authenticated users can insert job conformita document types" ON public.job_conformita_document_types;
CREATE POLICY "Authenticated users can insert job conformita document types" ON public.job_conformita_document_types
    FOR INSERT TO authenticated
    WITH CHECK (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));

DROP POLICY IF EXISTS "Authenticated users can update job conformita document types" ON public.job_conformita_document_types;
CREATE POLICY "Authenticated users can update job conformita document types" ON public.job_conformita_document_types
    FOR UPDATE TO authenticated
    USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));

DROP POLICY IF EXISTS "Authenticated users can delete job conformita document types" ON public.job_conformita_document_types;
CREATE POLICY "Authenticated users can delete job conformita document types" ON public.job_conformita_document_types
    FOR DELETE TO authenticated
    USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));

-- job_site_document_types
DROP POLICY IF EXISTS "Authenticated users can insert job commessa document types" ON public.job_site_document_types;
CREATE POLICY "Authenticated users can insert job commessa document types" ON public.job_site_document_types
    FOR INSERT TO authenticated
    WITH CHECK (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));

DROP POLICY IF EXISTS "Authenticated users can update job commessa document types" ON public.job_site_document_types;
CREATE POLICY "Authenticated users can update job commessa document types" ON public.job_site_document_types
    FOR UPDATE TO authenticated
    USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));

DROP POLICY IF EXISTS "Authenticated users can delete job commessa document types" ON public.job_site_document_types;
CREATE POLICY "Authenticated users can delete job commessa document types" ON public.job_site_document_types
    FOR DELETE TO authenticated
    USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));

-- proposal_document_types
DROP POLICY IF EXISTS "Authenticated users can insert proposal document types" ON public.proposal_document_types;
CREATE POLICY "Authenticated users can insert proposal document types" ON public.proposal_document_types
    FOR INSERT TO authenticated
    WITH CHECK (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));

DROP POLICY IF EXISTS "Authenticated users can update proposal document types" ON public.proposal_document_types;
CREATE POLICY "Authenticated users can update proposal document types" ON public.proposal_document_types
    FOR UPDATE TO authenticated
    USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));

DROP POLICY IF EXISTS "Authenticated users can delete proposal document types" ON public.proposal_document_types;
CREATE POLICY "Authenticated users can delete proposal document types" ON public.proposal_document_types
    FOR DELETE TO authenticated
    USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));
