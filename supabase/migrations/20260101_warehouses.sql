-- Create warehouses table
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow read for authenticated users"
    ON warehouses FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow insert for authenticated users"
    ON warehouses FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users"
    ON warehouses FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Allow delete for authenticated users"
    ON warehouses FOR DELETE
    TO authenticated
    USING (true);

-- Trigger: ensure only one warehouse can be primary
CREATE OR REPLACE FUNCTION ensure_single_primary_warehouse()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary THEN
        UPDATE warehouses SET is_primary = FALSE WHERE id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_single_primary_warehouse
AFTER INSERT OR UPDATE ON warehouses
FOR EACH ROW
WHEN (NEW.is_primary = TRUE)
EXECUTE FUNCTION ensure_single_primary_warehouse();

-- Update timestamp trigger
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON warehouses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
