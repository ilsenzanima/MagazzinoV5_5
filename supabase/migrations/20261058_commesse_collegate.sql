-- "Nuovo inizio" di un cantiere: la nuova commessa ricorda da quale deriva.
-- Le commesse collegate (stessa catena) servono ad esempio a riunire i documenti in un solo portale ospiti.
-- Undo: DROP FUNCTION public.get_job_chain(uuid); ALTER TABLE public.jobs DROP COLUMN origin_job_id;
ALTER TABLE public.jobs
    ADD COLUMN IF NOT EXISTS origin_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_origin_job_id ON public.jobs (origin_job_id);

-- Tutte le commesse della stessa catena di quella indicata (risale alla prima e scende su tutte le derivate)
CREATE OR REPLACE FUNCTION public.get_job_chain(p_job_id uuid)
RETURNS TABLE (id uuid, origin_job_id uuid, code text, name text, status text, start_date date)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    WITH RECURSIVE up AS (
        SELECT j.id, j.origin_job_id, 1 AS depth FROM jobs j WHERE j.id = p_job_id
        UNION
        SELECT p.id, p.origin_job_id, up.depth + 1 FROM jobs p JOIN up ON p.id = up.origin_job_id WHERE up.depth < 50
    ),
    root AS (
        SELECT up.id FROM up WHERE up.origin_job_id IS NULL
        UNION ALL
        SELECT up.id FROM up WHERE NOT EXISTS (SELECT 1 FROM jobs x WHERE x.id = up.origin_job_id)
        LIMIT 1
    ),
    down AS (
        SELECT j.id, 1 AS depth FROM jobs j WHERE j.id IN (SELECT root.id FROM root)
        UNION
        SELECT c.id, down.depth + 1 FROM jobs c JOIN down ON c.origin_job_id = down.id WHERE down.depth < 50
    )
    SELECT j.id, j.origin_job_id, j.code, j.name, j.status, j.start_date
    FROM jobs j
    WHERE j.id IN (SELECT down.id FROM down) AND j.deleted_at IS NULL
    ORDER BY j.start_date NULLS LAST, j.created_at;
$$;
