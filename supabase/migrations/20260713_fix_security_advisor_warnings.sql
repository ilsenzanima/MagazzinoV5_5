-- Risolve i warning del Security Advisor Supabase segnalati il 2026-07-13.

-- 1) job_compliance_associations: le policy INSERT/UPDATE per "authenticated" avevano
-- WITH CHECK/USING (true), permettendo a qualsiasi utente loggato (anche ruolo "user"
-- sola-lettura) di scrivere righe via API dirette. Tabella non scritta dal client
-- (solo da una rotta server-side), la restringiamo ad admin/operativo come le tabelle
-- di conformità analoghe.
DROP POLICY IF EXISTS "auth_insert_job_compliance_associations" ON public.job_compliance_associations;
CREATE POLICY "Job compliance associations insert by Admin/Operativo" ON public.job_compliance_associations
    FOR INSERT TO authenticated WITH CHECK ((select public.get_my_role()) IN ('admin', 'operativo'));

DROP POLICY IF EXISTS "auth_update_job_compliance_associations" ON public.job_compliance_associations;
CREATE POLICY "Job compliance associations update by Admin/Operativo" ON public.job_compliance_associations
    FOR UPDATE TO authenticated
    USING ((select public.get_my_role()) IN ('admin', 'operativo'))
    WITH CHECK ((select public.get_my_role()) IN ('admin', 'operativo'));

-- 2) delete_orphaned_shared_row(): funzione trigger SECURITY DEFINER, non deve essere
-- chiamabile direttamente via API da anon/authenticated (i trigger non necessitano del
-- privilegio EXECUTE per essere invocati dal motore).
REVOKE EXECUTE ON FUNCTION public.delete_orphaned_shared_row() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_orphaned_shared_row() FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_orphaned_shared_row() FROM authenticated;
