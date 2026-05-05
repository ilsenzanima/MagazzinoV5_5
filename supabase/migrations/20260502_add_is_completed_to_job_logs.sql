ALTER TABLE job_logs
    ADD COLUMN IF NOT EXISTS is_completed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_job_logs_is_completed ON job_logs(job_id, is_completed);
