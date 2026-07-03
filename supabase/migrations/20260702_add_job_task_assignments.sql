-- Cronoprogramma: pianificazione manodopera per fase (operai previsti e assegnazioni nominative)
ALTER TABLE job_tasks ADD COLUMN planned_workers integer;

CREATE TABLE job_task_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES job_tasks(id) ON DELETE CASCADE,
    worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (task_id, worker_id)
);

CREATE INDEX idx_job_task_assignments_task_id ON job_task_assignments(task_id);
CREATE INDEX idx_job_task_assignments_worker_id ON job_task_assignments(worker_id);

ALTER TABLE job_task_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read job task assignments"
    ON job_task_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert job task assignments"
    ON job_task_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update job task assignments"
    ON job_task_assignments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete job task assignments"
    ON job_task_assignments FOR DELETE TO authenticated USING (true);
