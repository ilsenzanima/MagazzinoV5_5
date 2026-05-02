-- Add trasferta_rate column to workers table
ALTER TABLE workers
    ADD COLUMN IF NOT EXISTS trasferta_rate numeric(10,2) NOT NULL DEFAULT 50.00;

COMMENT ON COLUMN workers.trasferta_rate IS 'Costo orario per trasferte in euro, default 50.00';
