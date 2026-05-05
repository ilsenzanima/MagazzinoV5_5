-- Add hourly_rate column to workers table
ALTER TABLE workers
    ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2) NOT NULL DEFAULT 25.00;

COMMENT ON COLUMN workers.hourly_rate IS 'Costo orario dell''operaio in euro, default 25.00';
