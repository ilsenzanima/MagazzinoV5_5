-- 1) Tabelle di log delle pulizie dati una tantum: esposte da PostgREST senza RLS.
--    RLS attiva e nessuna policy = nessun accesso da client; restano leggibili da SQL/service role.
-- Undo: ALTER TABLE public.<tabella> DISABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
    FOR t IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND NOT rowsecurity
          AND (tablename LIKE 'variant\_%\_log\_%' ESCAPE '\' OR tablename LIKE 'variant\_normalization\_log\_%' ESCAPE '\'
               OR tablename LIKE 'variant\_cleanup\_log\_%' ESCAPE '\' OR tablename LIKE 'merge\_log\_%' ESCAPE '\'
               OR tablename LIKE 'unit\_change\_log\_%' ESCAPE '\' OR tablename LIKE 'job\_price\_recalc\_log\_%' ESCAPE '\')
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- 2) load_note_items: due policy DELETE per authenticated; quella "solo admin" e' gia' compresa in "admin e operativo"
DROP POLICY IF EXISTS "Load note items deletable by admin" ON public.load_note_items;

-- 3) Indici sulle chiavi esterne mancanti (18 segnalazioni del controllo prestazioni)
CREATE INDEX IF NOT EXISTS idx_delivery_note_drafts_created_by ON public.delivery_note_drafts (created_by);
CREATE INDEX IF NOT EXISTS idx_delivery_note_drafts_from_warehouse_id ON public.delivery_note_drafts (from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_drafts_job_id ON public.delivery_note_drafts (job_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_drafts_to_warehouse_id ON public.delivery_note_drafts (to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_from_warehouse_id ON public.delivery_notes (from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_to_warehouse_id ON public.delivery_notes (to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_guest_sites_created_by ON public.guest_sites (created_by);
CREATE INDEX IF NOT EXISTS idx_inventory_verified_by ON public.inventory (verified_by);
CREATE INDEX IF NOT EXISTS idx_item_compliance_associations_created_by ON public.item_compliance_associations (created_by);
CREATE INDEX IF NOT EXISTS idx_job_compliance_associations_compliance_document_id ON public.job_compliance_associations (compliance_document_id);
CREATE INDEX IF NOT EXISTS idx_job_compliance_associations_created_by ON public.job_compliance_associations (created_by);
CREATE INDEX IF NOT EXISTS idx_job_document_folders_created_by ON public.job_document_folders (created_by);
CREATE INDEX IF NOT EXISTS idx_purchase_compliance_associations_created_by ON public.purchase_compliance_associations (created_by);
CREATE INDEX IF NOT EXISTS idx_purchase_items_returned_by ON public.purchase_items (returned_by);
CREATE INDEX IF NOT EXISTS idx_purchase_items_warehouse_id ON public.purchase_items (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_purchases_warehouse_id ON public.purchases (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_shared_compliance_associations_created_by ON public.shared_compliance_associations (created_by);
CREATE INDEX IF NOT EXISTS idx_shared_site_documents_uploaded_by ON public.shared_site_documents (uploaded_by);
