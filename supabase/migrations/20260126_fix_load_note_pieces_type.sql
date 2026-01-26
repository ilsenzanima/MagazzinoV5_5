-- Fix load_note_items pieces column type to match inventory
-- It was created as INTEGER but needs to be NUMERIC to support decimal pieces (e.g. 1.5)

ALTER TABLE load_note_items ALTER COLUMN pieces TYPE NUMERIC(10,2);
