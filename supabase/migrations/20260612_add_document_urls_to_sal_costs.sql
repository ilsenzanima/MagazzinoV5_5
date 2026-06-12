ALTER TABLE job_sal_costs
    ADD COLUMN IF NOT EXISTS document_urls text[] NOT NULL DEFAULT '{}';
