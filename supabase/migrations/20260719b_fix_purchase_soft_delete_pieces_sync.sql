-- Fix: handle_purchase_soft_delete() only adjusted inventory.quantity when a purchase
-- was trashed/restored, never inventory.pieces (same class of bug as the delivery-note
-- and purchase-item triggers fixed in 20260719_sync_inventory_pieces_tracking.sql).
-- Also recalculate_inventory_item() was missing a "p.deleted_at IS NULL" filter on the
-- purchased totals, so it wrongly included trashed purchases when recomputing
-- quantity/pieces from history.
--
-- Root cause found on ART-00169 (Promatect H): a real purchase (31.25/10pz) plus a
-- test purchase "Prova" (31.25/10pz) that was trashed the same day. Trashing correctly
-- subtracted quantity (back to the correct 31.25) but left pieces at 20 instead of 10.

CREATE OR REPLACE FUNCTION public.handle_purchase_soft_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Gli ordini non modificano l'inventario
    IF NEW.order_type = 'order' THEN
        RETURN NEW;
    END IF;

    -- Soft-delete: sottrae le quantità aggregate per articolo
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        UPDATE inventory i
        SET quantity = i.quantity - subtotals.total_qty,
            pieces = i.pieces - subtotals.total_pcs
        FROM (
            SELECT item_id, SUM(quantity) AS total_qty, SUM(COALESCE(pieces, 0)) AS total_pcs
            FROM purchase_items
            WHERE purchase_id = NEW.id
            GROUP BY item_id
        ) subtotals
        WHERE i.id = subtotals.item_id;
    END IF;

    -- Ripristino: aggiunge le quantità aggregate per articolo
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        UPDATE inventory i
        SET quantity = i.quantity + subtotals.total_qty,
            pieces = i.pieces + subtotals.total_pcs
        FROM (
            SELECT item_id, SUM(quantity) AS total_qty, SUM(COALESCE(pieces, 0)) AS total_pcs
            FROM purchase_items
            WHERE purchase_id = NEW.id
            GROUP BY item_id
        ) subtotals
        WHERE i.id = subtotals.item_id;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_inventory_item(target_item_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    total_purchased  NUMERIC(10,2) := 0;
    total_delivered  NUMERIC(10,2) := 0;
    total_legacy     NUMERIC(10,2) := 0;
    final_quantity   NUMERIC(10,2) := 0;
    pieces_purchased NUMERIC(10,2) := 0;
    pieces_delivered NUMERIC(10,2) := 0;
    final_pieces     NUMERIC(10,2) := 0;
BEGIN
    SELECT COALESCE(SUM(pi.quantity), 0), COALESCE(SUM(pi.pieces), 0)
    INTO total_purchased, pieces_purchased
    FROM public.purchase_items pi
    JOIN public.purchases p ON pi.purchase_id = p.id
    WHERE pi.item_id = target_item_id
      AND p.job_id IS NULL
      AND (p.order_type IS NULL OR p.order_type = 'purchase')
      AND p.deleted_at IS NULL;

    SELECT
        COALESCE(SUM(
            CASE
                WHEN dn.type = 'entry' THEN  dni.quantity
                WHEN dn.type IN ('exit', 'sale') THEN -dni.quantity
                ELSE 0
            END
        ), 0),
        COALESCE(SUM(
            CASE
                WHEN dn.type = 'entry' THEN  COALESCE(dni.pieces, 0)
                WHEN dn.type IN ('exit', 'sale') THEN -COALESCE(dni.pieces, 0)
                ELSE 0
            END
        ), 0)
    INTO total_delivered, pieces_delivered
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
    WHERE dni.inventory_id = target_item_id
      AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL);

    SELECT COALESCE(SUM(
        CASE WHEN type = 'load' THEN quantity WHEN type = 'unload' THEN -quantity ELSE 0 END
    ), 0) INTO total_legacy
    FROM public.movements
    WHERE item_id = target_item_id;

    final_quantity := total_purchased + total_delivered + total_legacy;
    final_pieces := pieces_purchased + pieces_delivered;

    UPDATE public.inventory SET quantity = final_quantity, pieces = final_pieces WHERE id = target_item_id;
END;
$function$;

-- One-off correction: only ART-00169 is affected (verified via dry-run before applying).
UPDATE public.inventory
SET pieces = 10.00
WHERE id = 'f9246f54-a7d3-4d7e-92f5-2b0e2c67c275'
  AND pieces = 20.00;
