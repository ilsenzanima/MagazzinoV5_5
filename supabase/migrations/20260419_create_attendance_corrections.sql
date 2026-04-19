-- Tabella per le rettifiche ore presenze
CREATE TABLE IF NOT EXISTS attendance_corrections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
    warehouse_id uuid REFERENCES warehouses(id) ON DELETE CASCADE,
    date date NOT NULL,
    hours_delta numeric(4,2) NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT chk_job_or_warehouse CHECK (job_id IS NOT NULL OR warehouse_id IS NOT NULL)
);

-- Indici univoci parziali per gestire i NULL correttamente
CREATE UNIQUE INDEX attendance_corrections_unique_job
    ON attendance_corrections(worker_id, date, job_id)
    WHERE job_id IS NOT NULL;

CREATE UNIQUE INDEX attendance_corrections_unique_warehouse
    ON attendance_corrections(worker_id, date, warehouse_id)
    WHERE warehouse_id IS NOT NULL;

CREATE INDEX attendance_corrections_worker_date ON attendance_corrections(worker_id, date);
CREATE INDEX attendance_corrections_date ON attendance_corrections(date);

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION update_attendance_corrections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attendance_corrections_updated_at
    BEFORE UPDATE ON attendance_corrections
    FOR EACH ROW EXECUTE FUNCTION update_attendance_corrections_updated_at();

-- RLS
ALTER TABLE attendance_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_corrections_select" ON attendance_corrections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
        )
    );

CREATE POLICY "attendance_corrections_insert" ON attendance_corrections
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND role IN ('admin', 'operativo')
        )
    );

CREATE POLICY "attendance_corrections_update" ON attendance_corrections
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND role IN ('admin', 'operativo')
        )
    );

CREATE POLICY "attendance_corrections_delete" ON attendance_corrections
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND role IN ('admin', 'operativo')
        )
    );
