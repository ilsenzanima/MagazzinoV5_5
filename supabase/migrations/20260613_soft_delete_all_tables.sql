-- Soft-delete (Cestino) per acquisti, fatture, bolle carico, clienti,
-- fornitori, inventario, commesse e operai.
-- Aggiunge: deleted_at, deleted_by, deleted_by_name
-- Aggiorna policy RLS SELECT per escludere i record eliminati dai non-admin
-- Cleanup automatico dopo 30 giorni via pg_cron

-- ── 1. Colonne soft-delete ───────────────────────────────────────────────────
ALTER TABLE public.purchases
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by_name TEXT DEFAULT NULL;

ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by_name TEXT DEFAULT NULL;

ALTER TABLE public.load_notes
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by_name TEXT DEFAULT NULL;

ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by_name TEXT DEFAULT NULL;

ALTER TABLE public.suppliers
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by_name TEXT DEFAULT NULL;

ALTER TABLE public.inventory
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by_name TEXT DEFAULT NULL;

ALTER TABLE public.jobs
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by_name TEXT DEFAULT NULL;

ALTER TABLE public.workers
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by_name TEXT DEFAULT NULL;

-- ── 2. Indici parziali per le query sul cestino ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_purchases_deleted_at  ON public.purchases(deleted_at)  WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at   ON public.invoices(deleted_at)   WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_load_notes_deleted_at ON public.load_notes(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at    ON public.clients(deleted_at)    WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_deleted_at  ON public.suppliers(deleted_at)  WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_deleted_at  ON public.inventory(deleted_at)  WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at       ON public.jobs(deleted_at)       WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workers_deleted_at    ON public.workers(deleted_at)    WHERE deleted_at IS NOT NULL;

-- ── 3. Policy RLS SELECT — nasconde i record soft-deleted ai non-admin ────────

-- PURCHASES
DROP POLICY IF EXISTS "Purchases viewable by all" ON public.purchases;
CREATE POLICY "Purchases viewable by all" ON public.purchases FOR SELECT TO authenticated
    USING (deleted_at IS NULL OR public.get_my_role() = 'admin');

-- INVOICES
DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT TO authenticated
    USING (deleted_at IS NULL OR public.get_my_role() = 'admin');

-- LOAD NOTES
DROP POLICY IF EXISTS "Authenticated users can read load_notes" ON public.load_notes;
CREATE POLICY "Authenticated users can read load_notes" ON public.load_notes FOR SELECT TO authenticated
    USING (deleted_at IS NULL OR public.get_my_role() = 'admin');

-- CLIENTS
DROP POLICY IF EXISTS "Clients viewable by all" ON public.clients;
CREATE POLICY "Clients viewable by all" ON public.clients FOR SELECT TO authenticated
    USING (deleted_at IS NULL OR public.get_my_role() = 'admin');

-- SUPPLIERS
DROP POLICY IF EXISTS "Suppliers viewable by all" ON public.suppliers;
CREATE POLICY "Suppliers viewable by all" ON public.suppliers FOR SELECT TO authenticated
    USING (deleted_at IS NULL OR public.get_my_role() = 'admin');

-- INVENTORY
DROP POLICY IF EXISTS "Inventory viewable by all" ON public.inventory;
CREATE POLICY "Inventory viewable by all" ON public.inventory FOR SELECT TO authenticated
    USING (deleted_at IS NULL OR public.get_my_role() = 'admin');

-- JOBS
DROP POLICY IF EXISTS "Jobs viewable by all" ON public.jobs;
CREATE POLICY "Jobs viewable by all" ON public.jobs FOR SELECT TO authenticated
    USING (deleted_at IS NULL OR public.get_my_role() = 'admin');

-- WORKERS
DROP POLICY IF EXISTS "Workers are viewable by authenticated users." ON public.workers;
CREATE POLICY "Workers are viewable by authenticated users." ON public.workers FOR SELECT TO authenticated
    USING (deleted_at IS NULL OR public.get_my_role() = 'admin');

-- ── 4. Funzione di cleanup automatico (chiamata da pg_cron) ─────────────────
CREATE OR REPLACE FUNCTION public.cleanup_soft_deleted_30d()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Acquisti: non elimina quelli con articoli movimentati in bolle
    DELETE FROM public.purchases p
    WHERE p.deleted_at IS NOT NULL
      AND p.deleted_at < NOW() - INTERVAL '30 days'
      AND NOT EXISTS (
          SELECT 1
          FROM public.purchase_items pi
          JOIN public.delivery_note_items dni ON dni.purchase_item_id = pi.id
          WHERE pi.purchase_id = p.id
      );

    DELETE FROM public.invoices
    WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days';

    DELETE FROM public.load_notes
    WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days';

    DELETE FROM public.clients
    WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days';

    DELETE FROM public.suppliers
    WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days';

    DELETE FROM public.inventory
    WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days';

    DELETE FROM public.jobs
    WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days';

    DELETE FROM public.workers
    WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days';
END;
$$;

-- ── 5. Pianifica il cleanup via pg_cron (ogni giorno alle 02:00) ─────────────
DO $$
BEGIN
    -- Rimuove job precedente se esiste
    PERFORM cron.unschedule('cleanup-soft-deleted-30d');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    PERFORM cron.schedule(
        'cleanup-soft-deleted-30d',
        '0 2 * * *',
        'SELECT public.cleanup_soft_deleted_30d()'
    );
EXCEPTION WHEN OTHERS THEN
    -- pg_cron non disponibile in questo piano Supabase — il cleanup va fatto manualmente
    RAISE WARNING 'pg_cron non disponibile: il job di cleanup automatico non è stato pianificato. Eseguire cleanup_soft_deleted_30d() manualmente.';
END $$;
