-- Cronoprogramma: fasi/attività pianificate per commessa, visualizzate come Gantt
CREATE TABLE job_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'delayed')),
    sort_order integer NOT NULL DEFAULT 0,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_tasks_job_id ON job_tasks(job_id);

ALTER TABLE job_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read job tasks"
    ON job_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert job tasks"
    ON job_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update job tasks"
    ON job_tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete job tasks"
    ON job_tasks FOR DELETE TO authenticated USING (true);
