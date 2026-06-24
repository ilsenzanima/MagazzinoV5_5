-- job_tasks: sostituisce le policy permissive (USING/WITH CHECK true) con controllo di ruolo,
-- come già fatto per jobs/clients in 20251226_optimize_performance.sql
DROP POLICY IF EXISTS "Authenticated users can insert job tasks" ON public.job_tasks;
DROP POLICY IF EXISTS "Authenticated users can update job tasks" ON public.job_tasks;
DROP POLICY IF EXISTS "Authenticated users can delete job tasks" ON public.job_tasks;

CREATE POLICY "Job tasks insert by Admin/Operativo" ON public.job_tasks
    FOR INSERT TO authenticated WITH CHECK ((select public.get_my_role()) IN ('admin', 'operativo'));
CREATE POLICY "Job tasks update by Admin/Operativo" ON public.job_tasks
    FOR UPDATE TO authenticated USING ((select public.get_my_role()) IN ('admin', 'operativo'));
CREATE POLICY "Job tasks delete by Admin/Operativo" ON public.job_tasks
    FOR DELETE TO authenticated USING ((select public.get_my_role()) IN ('admin', 'operativo'));

-- proposal_tasks: stesso schema
DROP POLICY IF EXISTS "Authenticated users can insert proposal tasks" ON public.proposal_tasks;
DROP POLICY IF EXISTS "Authenticated users can update proposal tasks" ON public.proposal_tasks;
DROP POLICY IF EXISTS "Authenticated users can delete proposal tasks" ON public.proposal_tasks;

CREATE POLICY "Proposal tasks insert by Admin/Operativo" ON public.proposal_tasks
    FOR INSERT TO authenticated WITH CHECK ((select public.get_my_role()) IN ('admin', 'operativo'));
CREATE POLICY "Proposal tasks update by Admin/Operativo" ON public.proposal_tasks
    FOR UPDATE TO authenticated USING ((select public.get_my_role()) IN ('admin', 'operativo'));
CREATE POLICY "Proposal tasks delete by Admin/Operativo" ON public.proposal_tasks
    FOR DELETE TO authenticated USING ((select public.get_my_role()) IN ('admin', 'operativo'));
