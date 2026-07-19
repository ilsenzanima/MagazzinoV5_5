-- Fix: purchase_items inserted with a job already assigned (the normal "acquisto
-- diretto per commessa" flow) correctly skipped general inventory, but never created
-- or updated a job_inventory row either -- the material became invisible to
-- job_inventory (used by the "rientro da cantiere" movement form). Only purchases
-- *reassigned* to a job after creation (handle_purchase_job_change, UPDATE of
-- purchases.job_id) ever populated job_inventory.
--
-- Verified: 12 job+item combos with real purchased material had no job_inventory
-- row at all (up to 2000 units missing), across multiple active jobs.
--
-- This rewrite also uses effective job_id = COALESCE(purchase_items.job_id,
-- purchases.job_id), matching stock_movements_view's logic, so a purchase_item's
-- own job_id (used for per-line job assignment within a single purchase) is
-- respected if set, and per-item UPDATE of job_id (already possible via
-- purchaseItemsApi.update) now correctly moves material between
-- inventory/job_inventory/another job, mirroring handle_purchase_job_change.

CREATE OR REPLACE FUNCTION public.handle_purchase_item_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_order_type TEXT;
    v_purchase_job_id UUID;
    v_old_pieces NUMERIC;
    v_new_pieces NUMERIC;
    v_old_job_id UUID;
    v_new_job_id UUID;
BEGIN
    IF current_setting('app.skip_inventory_on_delete', true) = 'true' THEN
        RETURN NULL;
    END IF;

    IF TG_OP = 'DELETE' THEN
        SELECT order_type, job_id INTO v_order_type, v_purchase_job_id FROM purchases WHERE id = OLD.purchase_id;
        v_old_job_id := COALESCE(OLD.job_id, v_purchase_job_id);
    ELSE
        SELECT order_type, job_id INTO v_order_type, v_purchase_job_id FROM purchases WHERE id = NEW.purchase_id;
        v_new_job_id := COALESCE(NEW.job_id, v_purchase_job_id);
        IF TG_OP = 'UPDATE' THEN
            v_old_job_id := COALESCE(OLD.job_id, v_purchase_job_id);
        END IF;
    END IF;

    IF v_order_type = 'order' THEN
        RETURN NULL;
    END IF;

    IF TG_OP = 'INSERT' THEN
        v_new_pieces := COALESCE(NEW.pieces, 0);
        IF v_new_job_id IS NULL THEN
            UPDATE inventory SET quantity = quantity + NEW.quantity, pieces = pieces + v_new_pieces WHERE id = NEW.item_id;
        ELSE
            INSERT INTO job_inventory (job_id, item_id, quantity, pieces)
            VALUES (v_new_job_id, NEW.item_id, NEW.quantity, v_new_pieces)
            ON CONFLICT (job_id, item_id) DO UPDATE SET
                quantity = job_inventory.quantity + EXCLUDED.quantity,
                pieces = job_inventory.pieces + EXCLUDED.pieces,
                updated_at = now();
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        v_old_pieces := COALESCE(OLD.pieces, 0);
        IF v_old_job_id IS NULL THEN
            UPDATE inventory SET quantity = quantity - OLD.quantity, pieces = pieces - v_old_pieces WHERE id = OLD.item_id;
        ELSE
            UPDATE job_inventory SET quantity = quantity - OLD.quantity, pieces = pieces - v_old_pieces, updated_at = now()
            WHERE job_id = v_old_job_id AND item_id = OLD.item_id;
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        v_old_pieces := COALESCE(OLD.pieces, 0);
        v_new_pieces := COALESCE(NEW.pieces, 0);

        IF v_old_job_id IS NOT DISTINCT FROM v_new_job_id THEN
            IF OLD.quantity IS DISTINCT FROM NEW.quantity OR v_old_pieces IS DISTINCT FROM v_new_pieces THEN
                IF v_new_job_id IS NULL THEN
                    UPDATE inventory SET quantity = quantity - OLD.quantity + NEW.quantity, pieces = pieces - v_old_pieces + v_new_pieces WHERE id = NEW.item_id;
                ELSE
                    UPDATE job_inventory SET quantity = quantity - OLD.quantity + NEW.quantity, pieces = pieces - v_old_pieces + v_new_pieces, updated_at = now()
                    WHERE job_id = v_new_job_id AND item_id = NEW.item_id;
                END IF;
            END IF;
        ELSE
            IF v_old_job_id IS NULL THEN
                UPDATE inventory SET quantity = quantity - OLD.quantity, pieces = pieces - v_old_pieces WHERE id = OLD.item_id;
            ELSE
                UPDATE job_inventory SET quantity = quantity - OLD.quantity, pieces = pieces - v_old_pieces, updated_at = now()
                WHERE job_id = v_old_job_id AND item_id = OLD.item_id;
            END IF;

            IF v_new_job_id IS NULL THEN
                UPDATE inventory SET quantity = quantity + NEW.quantity, pieces = pieces + v_new_pieces WHERE id = NEW.item_id;
            ELSE
                INSERT INTO job_inventory (job_id, item_id, quantity, pieces)
                VALUES (v_new_job_id, NEW.item_id, NEW.quantity, v_new_pieces)
                ON CONFLICT (job_id, item_id) DO UPDATE SET
                    quantity = job_inventory.quantity + EXCLUDED.quantity,
                    pieces = job_inventory.pieces + EXCLUDED.pieces,
                    updated_at = now();
            END IF;
        END IF;
    END IF;
    RETURN NULL;
END;
$function$;
