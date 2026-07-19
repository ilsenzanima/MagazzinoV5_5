-- Fix two latent issues in handle_purchase_job_change() found during audit:
-- 1. It didn't check order_type: reassigning the job on a pending "order" (not yet
--    received into stock) would move phantom quantity/pieces between inventory and
--    job_inventory for material that was never actually stocked.
-- 2. It silently swallowed ALL exceptions ("EXCEPTION WHEN OTHERS ... RETURN NEW"),
--    so if the inventory/job_inventory transfer failed for any reason, the purchase's
--    job_id change would still succeed while the material silently failed to move,
--    with only a WARNING nobody sees. Now errors propagate and roll back the change,
--    consistent with every other inventory-affecting trigger in this schema.
-- 3. It ignored purchase_items.job_id (per-line job override): if a specific line
--    already has its own job_id set (independent of the purchase-level job_id, the
--    "mixed purchase" feature), changing the purchase's job_id should not move that
--    line -- it now skips items where item_id-level job_id is explicitly set,
--    consistent with the COALESCE(pi.job_id, p.job_id) logic already applied to
--    handle_purchase_item_change() in the previous migration.

CREATE OR REPLACE FUNCTION public.handle_purchase_job_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    item_record RECORD;
    v_pieces NUMERIC;
    v_qty NUMERIC;
BEGIN
    -- Solo UPDATE e solo se job_id è cambiato
    IF TG_OP = 'UPDATE' AND (OLD.job_id IS DISTINCT FROM NEW.job_id) THEN

        -- Gli ordini non modificano l'inventario
        IF NEW.order_type = 'order' THEN
            RETURN NEW;
        END IF;

        -- Per ogni articolo dell'acquisto SENZA un job_id proprio (le righe con un
        -- job_id esplicito sono già assegnate indipendentemente e non seguono il
        -- cambio di commessa dell'acquisto padre)
        FOR item_record IN
            SELECT item_id, pieces, quantity
            FROM public.purchase_items
            WHERE purchase_id = NEW.id AND job_id IS NULL
        LOOP
            v_pieces := COALESCE(item_record.pieces, 0);
            v_qty := COALESCE(item_record.quantity, 0);

            -- SCENARIO 1: Da Magazzino (NULL) a Cantiere
            IF OLD.job_id IS NULL AND NEW.job_id IS NOT NULL THEN
                UPDATE public.inventory
                SET pieces = pieces - v_pieces,
                    quantity = quantity - v_qty
                WHERE id = item_record.item_id;

                INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
                VALUES (NEW.job_id, item_record.item_id, v_pieces, v_qty)
                ON CONFLICT (job_id, item_id)
                DO UPDATE SET
                    pieces = job_inventory.pieces + EXCLUDED.pieces,
                    quantity = job_inventory.quantity + EXCLUDED.quantity,
                    updated_at = now();

            -- SCENARIO 2: Da Cantiere a Magazzino (NULL)
            ELSIF OLD.job_id IS NOT NULL AND NEW.job_id IS NULL THEN
                UPDATE public.job_inventory
                SET pieces = pieces - v_pieces,
                    quantity = quantity - v_qty,
                    updated_at = now()
                WHERE job_id = OLD.job_id AND item_id = item_record.item_id;

                UPDATE public.inventory
                SET pieces = pieces + v_pieces,
                    quantity = quantity + v_qty
                WHERE id = item_record.item_id;

            -- SCENARIO 3: Da Cantiere A a Cantiere B
            ELSIF OLD.job_id IS NOT NULL AND NEW.job_id IS NOT NULL THEN
                UPDATE public.job_inventory
                SET pieces = pieces - v_pieces,
                    quantity = quantity - v_qty,
                    updated_at = now()
                WHERE job_id = OLD.job_id AND item_id = item_record.item_id;

                INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
                VALUES (NEW.job_id, item_record.item_id, v_pieces, v_qty)
                ON CONFLICT (job_id, item_id)
                DO UPDATE SET
                    pieces = job_inventory.pieces + EXCLUDED.pieces,
                    quantity = job_inventory.quantity + EXCLUDED.quantity,
                    updated_at = now();
            END IF;

        END LOOP;
    END IF;

    RETURN NEW;
END;
$function$;
