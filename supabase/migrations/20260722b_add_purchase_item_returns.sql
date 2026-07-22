-- Gestione resi al fornitore su righe acquisto (purchase_items).
--
-- Un reso sottrae pezzi/quantita' dalla riga acquisto (proprio come una modifica
-- manuale), cosi' il trigger esistente "on_purchase_item_change" propaga la
-- variazione al magazzino (o all'inventario di cantiere se l'acquisto e'
-- diretto in cantiere) esattamente come se quel materiale non fosse mai
-- arrivato. L'importo della riga (quantity * price) si riduce di conseguenza,
-- risultando visibile come una nota di credito.
--
-- I valori originali (pre_return_*) vengono salvati per poter annullare il
-- reso e ripristinare la riga.

ALTER TABLE public.purchase_items
    ADD COLUMN IF NOT EXISTS returned_quantity numeric(10,2),
    ADD COLUMN IF NOT EXISTS returned_pieces numeric(10,2),
    ADD COLUMN IF NOT EXISTS returned_at timestamptz,
    ADD COLUMN IF NOT EXISTS returned_by uuid REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS pre_return_quantity numeric(10,2),
    ADD COLUMN IF NOT EXISTS pre_return_pieces numeric(10,2);

COMMENT ON COLUMN public.purchase_items.returned_quantity IS 'Quantita'' resa al fornitore (gia'' sottratta da quantity)';
COMMENT ON COLUMN public.purchase_items.returned_pieces IS 'Pezzi resi al fornitore (gia'' sottratti da pieces)';
COMMENT ON COLUMN public.purchase_items.returned_at IS 'Data/ora di applicazione del reso (NULL = nessun reso attivo su questa riga)';
COMMENT ON COLUMN public.purchase_items.returned_by IS 'Utente che ha registrato il reso';
COMMENT ON COLUMN public.purchase_items.pre_return_quantity IS 'Quantity della riga prima del reso, per il ripristino';
COMMENT ON COLUMN public.purchase_items.pre_return_pieces IS 'Pieces della riga prima del reso, per il ripristino';

-- Consente ad una riga completamente resa di scendere a quantita' zero
-- (invece di dover rimanere sempre strettamente positiva).
ALTER TABLE public.purchase_items DROP CONSTRAINT IF EXISTS purchase_items_quantity_check;
ALTER TABLE public.purchase_items ADD CONSTRAINT purchase_items_quantity_check CHECK (quantity >= 0);
