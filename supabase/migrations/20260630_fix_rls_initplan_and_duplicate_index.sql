-- Ottimizza le policy RLS che chiamano auth.uid() direttamente (re-valutate per ogni riga)
-- racchiudendole in (select ...) cosi' Postgres le tratta come subplan stabile e le valuta una sola volta.

-- shared_documents
DROP POLICY IF EXISTS "authenticated all prop_docs" ON public.shared_documents;
CREATE POLICY "authenticated all prop_docs" ON public.shared_documents
    FOR ALL TO authenticated
    USING ((select auth.uid()) IS NOT NULL)
    WITH CHECK ((select auth.uid()) IS NOT NULL);

-- job_compliance_associations
DROP POLICY IF EXISTS "auth_insert_job_compliance_associations" ON public.job_compliance_associations;
CREATE POLICY "auth_insert_job_compliance_associations" ON public.job_compliance_associations
    FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "auth_update_job_compliance_associations" ON public.job_compliance_associations;
CREATE POLICY "auth_update_job_compliance_associations" ON public.job_compliance_associations
    FOR UPDATE TO authenticated
    USING ((select auth.uid()) IS NOT NULL)
    WITH CHECK ((select auth.uid()) IS NOT NULL);

-- proposal_compliance_associations
DROP POLICY IF EXISTS "auth_insert_proposal_compliance_associations" ON public.proposal_compliance_associations;
CREATE POLICY "auth_insert_proposal_compliance_associations" ON public.proposal_compliance_associations
    FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "auth_update_proposal_compliance_associations" ON public.proposal_compliance_associations;
CREATE POLICY "auth_update_proposal_compliance_associations" ON public.proposal_compliance_associations
    FOR UPDATE TO authenticated
    USING ((select auth.uid()) IS NOT NULL)
    WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Rimozione indice duplicato su shared_documents (mantenuto idx_shared_documents_job_id)
DROP INDEX IF EXISTS public.shared_documents_job_id_idx;
