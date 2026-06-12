CREATE TABLE IF NOT EXISTS job_cost_analysis_params (
    job_id              uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
    sfrido              numeric(5,2)  NOT NULL DEFAULT 5,
    sconto              numeric(5,2)  NOT NULL DEFAULT 0,
    trasporto           numeric(12,2) NOT NULL DEFAULT 0,
    posa                numeric(12,2) NOT NULL DEFAULT 0,
    ricarico            numeric(5,2)  NOT NULL DEFAULT 30,
    margine_trattativa  numeric(5,2)  NOT NULL DEFAULT 30,
    updated_at          timestamptz   NOT NULL DEFAULT now()
);
