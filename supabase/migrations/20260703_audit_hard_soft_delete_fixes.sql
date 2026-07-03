-- Audit hard/soft delete: tre correzioni emerse dalla revisione completa.

-- ── 1. owner_check vs FK SET NULL ────────────────────────────────────────────
-- Le tabelle condivise proposta/commessa hanno FK ON DELETE SET NULL (fix
-- precedente contro la perdita dei documenti condivisi), ma il vincolo CHECK
-- owner_check (proposal_id IS NOT NULL OR job_id IS NOT NULL) blocca il SET NULL
-- quando l'altro lato è già NULL: l'eliminazione definitiva di una commessa o
-- proposta con documenti "solo propri" fallirebbe con violazione del vincolo.
-- Sostituisce il CHECK con un trigger che elimina la riga quando entrambi i
-- lati diventano NULL (riga orfana: nessuno la può più vedere).

CREATE OR REPLACE FUNCTION public.delete_orphaned_shared_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.proposal_id IS NULL AND NEW.job_id IS NULL THEN
        EXECUTE format('DELETE FROM %I WHERE id = $1', TG_TABLE_NAME) USING NEW.id;
    END IF;
    RETURN NULL;
END;
$$;

ALTER TABLE shared_documents DROP CONSTRAINT shared_documents_owner_check;
CREATE TRIGGER trg_delete_orphaned_shared_documents
    AFTER UPDATE OF proposal_id, job_id ON shared_documents
    FOR EACH ROW EXECUTE FUNCTION public.delete_orphaned_shared_row();

ALTER TABLE shared_site_documents DROP CONSTRAINT shared_site_documents_owner_check;
CREATE TRIGGER trg_delete_orphaned_shared_site_documents
    AFTER UPDATE OF proposal_id, job_id ON shared_site_documents
    FOR EACH ROW EXECUTE FUNCTION public.delete_orphaned_shared_row();

ALTER TABLE shared_supplier_offers DROP CONSTRAINT shared_supplier_offers_owner_check;
CREATE TRIGGER trg_delete_orphaned_shared_supplier_offers
    AFTER UPDATE OF proposal_id, job_id ON shared_supplier_offers
    FOR EACH ROW EXECUTE FUNCTION public.delete_orphaned_shared_row();

ALTER TABLE shared_compliance_associations DROP CONSTRAINT shared_compliance_associations_owner_check;
CREATE TRIGGER trg_delete_orphaned_shared_compliance_associations
    AFTER UPDATE OF proposal_id, job_id ON shared_compliance_associations
    FOR EACH ROW EXECUTE FUNCTION public.delete_orphaned_shared_row();

-- ── 2. Storico presenze protetto dall'eliminazione operai ────────────────────
-- attendance.worker_id era ON DELETE CASCADE: eliminare definitivamente un
-- operaio dal Cestino cancellava tutte le sue presenze storiche, che alimentano
-- i costi manodopera dei SAL — i costi storici delle commesse cambierebbero
-- silenziosamente. Passa a RESTRICT: un operaio con presenze registrate non è
-- eliminabile definitivamente (resta soft-deleted), come già per gli articoli
-- con storico movimenti.
ALTER TABLE attendance DROP CONSTRAINT attendance_worker_id_fkey;
ALTER TABLE attendance ADD CONSTRAINT attendance_worker_id_fkey
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE RESTRICT;

-- ── 3. Rimozione funzione di cleanup automatico pericolosa ───────────────────
-- cleanup_soft_deleted_30d() faceva DELETE FROM purchases senza impostare
-- app.skip_inventory_on_delete: il trigger handle_purchase_item_change avrebbe
-- sottratto di nuovo le quantità dall'inventario (già corrette al soft-delete),
-- corrompendo le giacenze. Inoltre non eliminava i file su Drive/Storage
-- (orfani) e non copriva le proposte. pg_cron non è installato su questo
-- progetto, quindi non è mai stata eseguita automaticamente — ma resta un
-- foot-gun se invocata a mano. Lo svuotamento del cestino passa esclusivamente
-- da /api/purge-trash, che gestisce correttamente file e trigger.
DROP FUNCTION IF EXISTS public.cleanup_soft_deleted_30d();
