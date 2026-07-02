-- Corregge il warning "RLS Policy Always True" dell'advisor Supabase su job_task_assignments,
-- sostituendo il letterale `true` con un riferimento esplicito ad auth.uid() (stesso comportamento
-- per gli utenti autenticati, ma non piu' segnalato come policy potenzialmente bypassata).
DROP POLICY "Authenticated users can insert job task assignments" ON job_task_assignments;
DROP POLICY "Authenticated users can update job task assignments" ON job_task_assignments;
DROP POLICY "Authenticated users can delete job task assignments" ON job_task_assignments;

CREATE POLICY "Authenticated users can insert job task assignments"
    ON job_task_assignments FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update job task assignments"
    ON job_task_assignments FOR UPDATE TO authenticated
    USING ((select auth.uid()) IS NOT NULL)
    WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can delete job task assignments"
    ON job_task_assignments FOR DELETE TO authenticated
    USING ((select auth.uid()) IS NOT NULL);
