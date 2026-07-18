-- Flag di controllo admin sui nuovi articoli creati in magazzino: un admin
-- rivede i dati (in particolare il coefficiente, modificabile da chiunque in
-- creazione) e marca l'articolo come verificato dalla pagina /inventory/verifica.
ALTER TABLE public.inventory
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS verified_by_name TEXT DEFAULT NULL;

-- Backfill: gli articoli già esistenti si considerano già controllati,
-- solo quelli creati da questo momento in poi entrano nella coda di verifica.
UPDATE public.inventory SET verified_at = now() WHERE verified_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_verified_at ON public.inventory(verified_at) WHERE verified_at IS NULL;
