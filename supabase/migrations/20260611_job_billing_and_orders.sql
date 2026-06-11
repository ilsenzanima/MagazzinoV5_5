-- Add estimated cost to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_cost numeric(12,2);

-- SAL approvati dal cliente
CREATE TABLE IF NOT EXISTS job_sal_approvati (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    name text NOT NULL,
    amount numeric(12,2) NOT NULL DEFAULT 0,
    document_url text,
    notes text,
    created_at timestamptz DEFAULT now()
);

-- Fatture pagate dal committente
CREATE TABLE IF NOT EXISTS job_fatture_committente (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    name text NOT NULL,
    amount numeric(12,2) NOT NULL DEFAULT 0,
    document_url text,
    notes text,
    created_at timestamptz DEFAULT now()
);

-- Collegamento SAL ↔ Fattura (importo parziale per ciascun link)
CREATE TABLE IF NOT EXISTS job_sal_fattura_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sal_id uuid NOT NULL REFERENCES job_sal_approvati(id) ON DELETE CASCADE,
    fattura_id uuid NOT NULL REFERENCES job_fatture_committente(id) ON DELETE CASCADE,
    amount numeric(12,2) NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(sal_id, fattura_id)
);

-- RLS
ALTER TABLE job_sal_approvati ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_fatture_committente ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_sal_fattura_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_sal_approvati" ON job_sal_approvati
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all_fatture_committente" ON job_fatture_committente
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all_sal_fattura_links" ON job_sal_fattura_links
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_sal_approvati_job_id ON job_sal_approvati(job_id);
CREATE INDEX IF NOT EXISTS idx_job_fatture_committente_job_id ON job_fatture_committente(job_id);
CREATE INDEX IF NOT EXISTS idx_job_sal_fattura_links_sal_id ON job_sal_fattura_links(sal_id);
CREATE INDEX IF NOT EXISTS idx_job_sal_fattura_links_fattura_id ON job_sal_fattura_links(fattura_id);
