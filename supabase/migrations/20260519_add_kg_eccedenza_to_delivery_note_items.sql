-- Aggiunge il campo kg_eccedenza dedicato alle bolle di eccedenza (type='waste')
-- Questo campo è indipendente dalla quantità normale e viene compilato solo per le bolle eccedenza

ALTER TABLE public.delivery_note_items
ADD COLUMN IF NOT EXISTS kg_eccedenza NUMERIC(10, 3);
