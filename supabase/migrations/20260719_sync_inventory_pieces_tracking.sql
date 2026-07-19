-- Fix: inventory.pieces (and job_inventory.pieces) were never decremented/incremented
-- by normal delivery-note-item and purchase-item changes; only inventory.quantity was.
-- Only the "whole delivery note deletion" path (handle_delivery_note_deletion) touched
-- both fields. This caused `pieces` to drift upward over time (it only ever grew from
-- purchases) while `quantity` stayed correct, e.g. COL-PRO-018 had pieces=44.55 vs the
-- real quantity=30.95 with coefficient=1 (they should match).
--
-- This migration:
-- 1. Updates handle_movement_logic() to keep inventory.pieces / job_inventory.pieces
--    in sync with every delivery-note-item insert/update/delete, mirroring the existing
--    quantity logic.
-- 2. Updates handle_purchase_item_change() to keep inventory.pieces in sync with
--    purchase-item insert/update/delete, mirroring the existing quantity logic.
-- 3. Extends recalculate_inventory_item()/recalculate_all_inventory() to also
--    recompute pieces from history, and runs it once to fix existing drifted data.

CREATE OR REPLACE FUNCTION public.handle_movement_logic()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  note_type TEXT;
  note_job_id UUID;
  diff NUMERIC;
  diff_pieces NUMERIC;
  new_pieces NUMERIC;
  old_pieces NUMERIC;
BEGIN
  SELECT type, job_id INTO note_type, note_job_id
  FROM public.delivery_notes
  WHERE id = COALESCE(NEW.delivery_note_id, OLD.delivery_note_id);

  IF note_type = 'waste' THEN
    RETURN NULL;
  END IF;

  new_pieces := COALESCE(NEW.pieces, 0);
  old_pieces := COALESCE(OLD.pieces, 0);

  IF TG_OP = 'INSERT' THEN
    IF note_type IN ('exit', 'sale') THEN
      IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
        INSERT INTO public.job_inventory (job_id, item_id, quantity, pieces)
        VALUES (note_job_id, NEW.inventory_id, NEW.quantity, new_pieces)
        ON CONFLICT (job_id, item_id)
        DO UPDATE SET
          quantity = job_inventory.quantity + EXCLUDED.quantity,
          pieces = job_inventory.pieces + EXCLUDED.pieces,
          updated_at = now();
      END IF;
      IF NOT NEW.is_fictitious THEN
        UPDATE public.inventory
        SET quantity = quantity - NEW.quantity,
            pieces = pieces - new_pieces
        WHERE id = NEW.inventory_id;
      END IF;
    ELSIF note_type = 'entry' THEN
      IF note_job_id IS NOT NULL THEN
        UPDATE public.job_inventory
        SET quantity = quantity - NEW.quantity, pieces = pieces - new_pieces, updated_at = now()
        WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
      END IF;
      IF NOT NEW.is_fictitious THEN
        UPDATE public.inventory
        SET quantity = quantity + NEW.quantity,
            pieces = pieces + new_pieces
        WHERE id = NEW.inventory_id;
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF note_type IN ('exit', 'sale') THEN
      IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
        UPDATE public.job_inventory
        SET quantity = quantity - OLD.quantity, pieces = pieces - old_pieces
        WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
      END IF;
      IF NOT OLD.is_fictitious THEN
        UPDATE public.inventory
        SET quantity = quantity + OLD.quantity,
            pieces = pieces + old_pieces
        WHERE id = OLD.inventory_id;
      END IF;
    ELSIF note_type = 'entry' THEN
      IF note_job_id IS NOT NULL THEN
        UPDATE public.job_inventory
        SET quantity = quantity + OLD.quantity, pieces = pieces + old_pieces
        WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
      END IF;
      IF NOT OLD.is_fictitious THEN
        UPDATE public.inventory
        SET quantity = quantity - OLD.quantity,
            pieces = pieces - old_pieces
        WHERE id = OLD.inventory_id;
      END IF;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    diff := NEW.quantity - OLD.quantity;
    diff_pieces := new_pieces - old_pieces;

    IF NOT NEW.is_fictitious AND NOT OLD.is_fictitious THEN
      IF diff <> 0 OR diff_pieces <> 0 THEN
        IF note_type IN ('exit', 'sale') THEN
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
            INSERT INTO public.job_inventory (job_id, item_id, quantity, pieces)
            VALUES (note_job_id, NEW.inventory_id, diff, diff_pieces)
            ON CONFLICT (job_id, item_id)
            DO UPDATE SET quantity = job_inventory.quantity + diff, pieces = job_inventory.pieces + diff_pieces, updated_at = now();
          END IF;
          UPDATE public.inventory SET quantity = quantity - diff, pieces = pieces - diff_pieces WHERE id = NEW.inventory_id;
        ELSIF note_type = 'entry' THEN
          IF note_job_id IS NOT NULL THEN
            UPDATE public.job_inventory SET quantity = quantity - diff, pieces = pieces - diff_pieces, updated_at = now()
            WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
          END IF;
          UPDATE public.inventory SET quantity = quantity + diff, pieces = pieces + diff_pieces WHERE id = NEW.inventory_id;
        END IF;
      END IF;

    ELSIF OLD.is_fictitious AND NOT NEW.is_fictitious THEN
      IF note_type IN ('exit', 'sale') THEN
        UPDATE public.inventory SET quantity = quantity - NEW.quantity, pieces = pieces - new_pieces WHERE id = NEW.inventory_id;
      ELSIF note_type = 'entry' THEN
        UPDATE public.inventory SET quantity = quantity + NEW.quantity, pieces = pieces + new_pieces WHERE id = NEW.inventory_id;
      END IF;
      IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
        INSERT INTO public.job_inventory (job_id, item_id, quantity, pieces)
        VALUES (note_job_id, NEW.inventory_id, diff, diff_pieces)
        ON CONFLICT (job_id, item_id)
        DO UPDATE SET quantity = job_inventory.quantity + diff, pieces = job_inventory.pieces + diff_pieces, updated_at = now();
      ELSIF note_type = 'entry' AND note_job_id IS NOT NULL THEN
        UPDATE public.job_inventory SET quantity = quantity - diff, pieces = pieces - diff_pieces, updated_at = now()
        WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
      END IF;

    ELSIF NOT OLD.is_fictitious AND NEW.is_fictitious THEN
      IF note_type IN ('exit', 'sale') THEN
        UPDATE public.inventory SET quantity = quantity + OLD.quantity, pieces = pieces + old_pieces WHERE id = OLD.inventory_id;
      ELSIF note_type = 'entry' THEN
        UPDATE public.inventory SET quantity = quantity - OLD.quantity, pieces = pieces - old_pieces WHERE id = OLD.inventory_id;
      END IF;
      IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
        INSERT INTO public.job_inventory (job_id, item_id, quantity, pieces)
        VALUES (note_job_id, NEW.inventory_id, diff, diff_pieces)
        ON CONFLICT (job_id, item_id)
        DO UPDATE SET quantity = job_inventory.quantity + diff, pieces = job_inventory.pieces + diff_pieces, updated_at = now();
      ELSIF note_type = 'entry' AND note_job_id IS NOT NULL THEN
        UPDATE public.job_inventory SET quantity = quantity - diff, pieces = pieces - diff_pieces, updated_at = now()
        WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
      END IF;

    ELSE
      IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
        INSERT INTO public.job_inventory (job_id, item_id, quantity, pieces)
        VALUES (note_job_id, NEW.inventory_id, diff, diff_pieces)
        ON CONFLICT (job_id, item_id)
        DO UPDATE SET quantity = job_inventory.quantity + diff, pieces = job_inventory.pieces + diff_pieces, updated_at = now();
      ELSIF note_type = 'entry' AND note_job_id IS NOT NULL THEN
        UPDATE public.job_inventory SET quantity = quantity - diff, pieces = pieces - diff_pieces, updated_at = now()
        WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_purchase_item_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_order_type TEXT;
    v_job_id UUID;
    v_old_pieces NUMERIC;
    v_new_pieces NUMERIC;
BEGIN
    -- Skip se richiesto esplicitamente (hard-delete da cestino)
    IF current_setting('app.skip_inventory_on_delete', true) = 'true' THEN
        RETURN NULL;
    END IF;

    -- Leggi il tipo e la commessa della bolla padre
    IF TG_OP = 'DELETE' THEN
        SELECT order_type, job_id INTO v_order_type, v_job_id FROM purchases WHERE id = OLD.purchase_id;
    ELSE
        SELECT order_type, job_id INTO v_order_type, v_job_id FROM purchases WHERE id = NEW.purchase_id;
    END IF;

    -- Gli ordini non modificano l'inventario
    IF v_order_type = 'order' THEN
        RETURN NULL;
    END IF;

    -- Gli acquisti destinati a una commessa specifica non modificano il magazzino generale
    IF v_job_id IS NOT NULL THEN
        RETURN NULL;
    END IF;

    IF TG_OP = 'INSERT' THEN
        v_new_pieces := COALESCE(NEW.pieces, 0);
        UPDATE inventory SET quantity = quantity + NEW.quantity, pieces = pieces + v_new_pieces WHERE id = NEW.item_id;
    ELSIF TG_OP = 'DELETE' THEN
        v_old_pieces := COALESCE(OLD.pieces, 0);
        UPDATE inventory SET quantity = quantity - OLD.quantity, pieces = pieces - v_old_pieces WHERE id = OLD.item_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_pieces := COALESCE(OLD.pieces, 0);
        v_new_pieces := COALESCE(NEW.pieces, 0);
        IF OLD.quantity IS DISTINCT FROM NEW.quantity OR v_old_pieces IS DISTINCT FROM v_new_pieces THEN
            UPDATE inventory SET quantity = quantity - OLD.quantity + NEW.quantity, pieces = pieces - v_old_pieces + v_new_pieces WHERE id = NEW.item_id;
        END IF;
    END IF;
    RETURN NULL;
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
      AND (p.order_type IS NULL OR p.order_type = 'purchase');

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

-- One-time data fix: realign `pieces` only (quantity is left untouched here -- a
-- separate pre-existing discrepancy was found on one unrelated item, ART-00169,
-- where recalculating quantity from history would change 31.25 -> 62.50; that is
-- a distinct anomaly that needs its own review and is intentionally NOT touched
-- by this migration).
WITH purchased AS (
    SELECT pi.item_id, COALESCE(SUM(pi.pieces), 0) AS pcs
    FROM public.purchase_items pi
    JOIN public.purchases p ON pi.purchase_id = p.id
    WHERE p.job_id IS NULL AND (p.order_type IS NULL OR p.order_type = 'purchase')
    GROUP BY pi.item_id
),
delivered AS (
    SELECT dni.inventory_id AS item_id,
        COALESCE(SUM(
            CASE
                WHEN dn.type = 'entry' THEN COALESCE(dni.pieces, 0)
                WHEN dn.type IN ('exit', 'sale') THEN -COALESCE(dni.pieces, 0)
                ELSE 0
            END
        ), 0) AS pcs
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
    WHERE (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
    GROUP BY dni.inventory_id
)
UPDATE public.inventory i
SET pieces = COALESCE(pu.pcs, 0) + COALESCE(d.pcs, 0)
FROM (SELECT id FROM public.inventory) all_i
LEFT JOIN purchased pu ON pu.item_id = all_i.id
LEFT JOIN delivered d ON d.item_id = all_i.id
WHERE i.id = all_i.id
  AND i.deleted_at IS NULL
  AND ABS(i.pieces - (COALESCE(pu.pcs, 0) + COALESCE(d.pcs, 0))) > 0.01;
