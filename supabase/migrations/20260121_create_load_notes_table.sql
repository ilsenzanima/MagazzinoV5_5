-- Migration: Create load_notes table for managing preloaded material notes
-- This table stores notes about materials taken to job sites before they are formally tracked in movements

-- Create the load_notes table
CREATE TABLE IF NOT EXISTS load_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    note_type VARCHAR(10) NOT NULL DEFAULT 'uscita' CHECK (note_type IN ('uscita', 'reso')),
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create the load_note_items table (materials in each note)
CREATE TABLE IF NOT EXISTS load_note_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    load_note_id UUID NOT NULL REFERENCES load_notes(id) ON DELETE CASCADE,
    inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    pieces INTEGER,
    quantity NUMERIC(12, 4) NOT NULL,
    is_checked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_load_notes_job_id ON load_notes(job_id);
CREATE INDEX IF NOT EXISTS idx_load_notes_status ON load_notes(status);
CREATE INDEX IF NOT EXISTS idx_load_notes_date ON load_notes(date DESC);
CREATE INDEX IF NOT EXISTS idx_load_notes_created_by ON load_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_load_note_items_load_note_id ON load_note_items(load_note_id);
CREATE INDEX IF NOT EXISTS idx_load_note_items_inventory_id ON load_note_items(inventory_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_load_notes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS load_notes_updated_at_trigger ON load_notes;
CREATE TRIGGER load_notes_updated_at_trigger
    BEFORE UPDATE ON load_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_load_notes_updated_at();

-- Enable RLS
ALTER TABLE load_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_note_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for load_notes
CREATE POLICY "Authenticated users can read load_notes"
    ON load_notes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Operativo and above can create load_notes"
    ON load_notes FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'responsabile', 'operativo')
        )
    );

CREATE POLICY "Operativo and above can update load_notes"
    ON load_notes FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'responsabile', 'operativo')
        )
    );

CREATE POLICY "Admin and responsabile can delete load_notes"
    ON load_notes FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'responsabile')
        )
    );

-- RLS Policies for load_note_items
CREATE POLICY "Authenticated users can read load_note_items"
    ON load_note_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Operativo and above can create load_note_items"
    ON load_note_items FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'responsabile', 'operativo')
        )
    );

CREATE POLICY "Operativo and above can update load_note_items"
    ON load_note_items FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'responsabile', 'operativo')
        )
    );

CREATE POLICY "Admin and responsabile can delete load_note_items"
    ON load_note_items FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'responsabile')
        )
    );

-- Create a view that includes creator name and job info for easier querying
CREATE OR REPLACE VIEW load_notes_with_details AS
SELECT 
    ln.*,
    j.code AS job_code,
    j.name AS job_description,
    p.full_name AS created_by_name,
    (
        SELECT COUNT(*) 
        FROM load_note_items lni 
        WHERE lni.load_note_id = ln.id
    ) AS items_count
FROM load_notes ln
LEFT JOIN jobs j ON ln.job_id = j.id
LEFT JOIN profiles p ON ln.created_by = p.id;

-- Grant permissions
GRANT SELECT ON load_notes_with_details TO authenticated;

COMMENT ON TABLE load_notes IS 'Notes for materials taken to job sites before formal tracking';
COMMENT ON TABLE load_note_items IS 'Individual material items within a load note';
COMMENT ON VIEW load_notes_with_details IS 'Load notes with job and creator details';
