-- Flag per le commesse create solo per archiviare documentazione di vendita
-- (es. vendita di materiale), senza un vero cantiere associato.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_sale_only BOOLEAN NOT NULL DEFAULT false;
