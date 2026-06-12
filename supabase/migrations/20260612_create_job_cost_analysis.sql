CREATE TABLE IF NOT EXISTS job_cost_analysis_rows (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    type            text NOT NULL CHECK (type IN ('inventory', 'generic')),
    item_id         uuid REFERENCES inventory(id) ON DELETE SET NULL,
    item_name       text NOT NULL DEFAULT '',
    item_model      text NOT NULL DEFAULT '',
    item_unit       text NOT NULL DEFAULT '',
    max_purchase_price numeric(12,4),
    unit_price      numeric(12,4),
    qty_estimated   numeric(12,4) NOT NULL DEFAULT 0,
    qty_actual      numeric(12,4) NOT NULL DEFAULT 0,
    sort_order      integer NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_cost_analysis_job_id ON job_cost_analysis_rows(job_id);
