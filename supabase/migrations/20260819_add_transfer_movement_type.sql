-- Nuovo tipo movimento "Trasferimento Magazzino": formalità documentale per
-- tracciare uno spostamento tra magazzini. Come waste, non tocca mai
-- inventory/job_inventory (le righe sono sempre fittizie lato applicazione,
-- ma lo escludiamo anche qui per sicurezza) e non compare nello storico
-- movimenti di stock.

-- 1. Estendi il CHECK constraint su delivery_notes.type per includere 'transfer'
ALTER TABLE public.delivery_notes
  DROP CONSTRAINT IF EXISTS delivery_notes_type_check;

ALTER TABLE public.delivery_notes
  ADD CONSTRAINT delivery_notes_type_check
  CHECK (type IN ('entry', 'exit', 'sale', 'waste', 'transfer'));

-- 2. Aggiorna handle_movement_logic() perché 'transfer', come 'waste', non
-- tocchi mai inventory/job_inventory (early return, stessa identica logica
-- della versione corrente in 20260719_sync_inventory_pieces_tracking.sql,
-- con la sola aggiunta del ramo transfer).
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

  IF note_type IN ('waste', 'transfer') THEN
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

-- 3. Ricrea il trigger (per sicurezza)
DROP TRIGGER IF EXISTS on_delivery_note_item_change ON public.delivery_note_items;
CREATE TRIGGER on_delivery_note_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_note_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_movement_logic();

-- 4. Aggiorna stock_movements_view escludendo anche i movimenti transfer,
-- oltre ai waste (stessa identica definizione corrente in
-- 20260614_exclude_orders_from_inventory_views.sql, con solo il filtro esteso).
DROP VIEW IF EXISTS public.stock_movements_view;

CREATE OR REPLACE VIEW public.stock_movements_view WITH (security_invoker = true) AS
SELECT
    pi.id,
    pi.created_at as date,
    'purchase' as type,
    pi.quantity as quantity,
    p.delivery_note_number as reference,
    pi.item_id,
    p.created_by as user_id,
    pr.full_name as user_name,
    i.code as item_code,
    i.name as item_name,
    i.model as item_model,
    i.unit as item_unit,
    pi.price as item_price,
    pi.pieces,
    pi.coefficient,
    p.notes,
    COALESCE(pi.job_id, p.job_id) as job_id,
    j.code as job_code,
    j.description as job_description,
    FALSE as is_fictitious,
    s.name as supplier_name,
    p.delivery_note_date as purchase_date,
    p.delivery_note_number as purchase_number,
    p.id as purchase_id,
    NULL::uuid as delivery_note_id
FROM public.purchase_items pi
JOIN public.purchases p ON pi.purchase_id = p.id
LEFT JOIN public.profiles pr ON p.created_by = pr.id
LEFT JOIN public.inventory i ON pi.item_id = i.id
LEFT JOIN public.suppliers s ON p.supplier_id = s.id
LEFT JOIN public.jobs j ON COALESCE(pi.job_id, p.job_id) = j.id
WHERE p.order_type = 'purchase'  -- exclude orders
  AND p.deleted_at IS NULL        -- exclude soft-deleted

UNION ALL

SELECT
    dni.id,
    dni.created_at as date,
    dn.type,
    CASE
        WHEN dn.type = 'entry' THEN dni.quantity
        ELSE -dni.quantity
    END as quantity,
    dn.number as reference,
    dni.inventory_id as item_id,
    dn.created_by as user_id,
    pr.full_name as user_name,
    i.code as item_code,
    i.name as item_name,
    i.model as item_model,
    i.unit as item_unit,
    COALESCE(pi.price, i.price) as item_price,
    dni.pieces,
    dni.coefficient,
    dn.notes,
    dn.job_id,
    j.code as job_code,
    j.description as job_description,
    dni.is_fictitious,
    s.name as supplier_name,
    p.delivery_note_date as purchase_date,
    p.delivery_note_number as purchase_number,
    p.id as purchase_id,
    dn.id as delivery_note_id
FROM public.delivery_note_items dni
JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
LEFT JOIN public.profiles pr ON dn.created_by = pr.id
LEFT JOIN public.inventory i ON dni.inventory_id = i.id
LEFT JOIN public.purchase_items pi ON dni.purchase_item_id = pi.id
LEFT JOIN public.purchases p ON pi.purchase_id = p.id
LEFT JOIN public.suppliers s ON p.supplier_id = s.id
LEFT JOIN public.jobs j ON dn.job_id = j.id
WHERE dn.type NOT IN ('waste', 'transfer')

UNION ALL

SELECT
    m.id,
    m.created_at as date,
    CASE
        WHEN m.type = 'load' THEN 'entry'
        WHEN m.type = 'unload' THEN 'exit'
        ELSE m.type
    END as type,
    CASE
        WHEN m.type = 'load' THEN m.quantity
        ELSE -m.quantity
    END as quantity,
    m.reference,
    m.item_id,
    m.user_id,
    pr.full_name as user_name,
    i.code as item_code,
    i.name as item_name,
    i.model as item_model,
    i.unit as item_unit,
    i.price as item_price,
    NULL as pieces,
    NULL as coefficient,
    m.notes,
    m.job_id,
    j.code as job_code,
    j.description as job_description,
    FALSE as is_fictitious,
    NULL as supplier_name,
    NULL as purchase_date,
    NULL as purchase_number,
    NULL as purchase_id,
    NULL as delivery_note_id
FROM public.movements m
LEFT JOIN public.profiles pr ON m.user_id = pr.id
LEFT JOIN public.inventory i ON m.item_id = i.id
LEFT JOIN public.jobs j ON m.job_id = j.id;

GRANT SELECT ON public.stock_movements_view TO authenticated;
