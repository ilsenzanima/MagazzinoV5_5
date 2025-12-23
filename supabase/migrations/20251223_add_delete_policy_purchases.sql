-- 1. FIX POLICIES (Drop if exists to avoid errors)
DROP POLICY IF EXISTS "Authenticated users can delete purchases." ON purchases;
DROP POLICY IF EXISTS "Authenticated users can delete purchase items." ON purchase_items;

create policy "Authenticated users can delete purchases."
  on purchases for delete
  to authenticated
  using ( true );

create policy "Authenticated users can delete purchase items."
  on purchase_items for delete
  to authenticated
  using ( true );

-- 2. ENSURE COLUMNS AND DEFAULTS
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS pieces NUMERIC(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.job_inventory ADD COLUMN IF NOT EXISTS pieces NUMERIC(10,2) DEFAULT 0 NOT NULL;

UPDATE public.inventory SET coefficient = 1 WHERE coefficient IS NULL OR coefficient = 0;
UPDATE public.purchase_items SET coefficient = 1 WHERE coefficient IS NULL OR coefficient = 0;
UPDATE public.delivery_note_items SET coefficient = 1 WHERE coefficient IS NULL OR coefficient = 0;

-- 3. HELPER: Calculate Quantity from Pieces (and vice-versa)
CREATE OR REPLACE FUNCTION public.calculate_quantity_from_pieces()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.pieces IS NOT NULL THEN
        NEW.quantity := NEW.pieces * NEW.coefficient;
    ELSIF NEW.quantity IS NOT NULL AND NEW.pieces IS NULL THEN
        IF NEW.coefficient <> 0 THEN
            NEW.pieces := ROUND(NEW.quantity / NEW.coefficient, 2);
            NEW.quantity := NEW.pieces * NEW.coefficient;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_purchase_quantity ON public.purchase_items;
CREATE TRIGGER ensure_purchase_quantity
    BEFORE INSERT OR UPDATE ON public.purchase_items
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_quantity_from_pieces();

DROP TRIGGER IF EXISTS ensure_delivery_quantity ON public.delivery_note_items;
CREATE TRIGGER ensure_delivery_quantity
    BEFORE INSERT OR UPDATE ON public.delivery_note_items
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_quantity_from_pieces();

-- 4. VIEW: Purchase Batches (With Prices, Pieces, and Fictitious Exclusion)
DROP VIEW IF EXISTS public.purchase_batch_availability;
CREATE OR REPLACE VIEW public.purchase_batch_availability AS
SELECT 
    pi.id as purchase_item_id,
    pi.item_id,
    p.delivery_note_number as purchase_ref,
    p.created_at as purchase_date,
    pi.price as unit_price,
    pi.coefficient as coefficient,
    pi.quantity as original_quantity,
    pi.quantity - COALESCE((
        SELECT SUM(dni.quantity)
        FROM public.delivery_note_items dni
        JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
        WHERE dni.purchase_item_id = pi.id
        AND dn.type IN ('exit', 'sale')
        AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
    ), 0) as remaining_quantity,
    pi.pieces as original_pieces,
    pi.pieces - COALESCE((
        SELECT SUM(dni.pieces)
        FROM public.delivery_note_items dni
        JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
        WHERE dni.purchase_item_id = pi.id
        AND dn.type IN ('exit', 'sale')
        AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
    ), 0) as remaining_pieces
FROM public.purchase_items pi
JOIN public.purchases p ON pi.purchase_id = p.id
WHERE (
    pi.pieces - COALESCE((
        SELECT SUM(dni.pieces)
        FROM public.delivery_note_items dni
        JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
        WHERE dni.purchase_item_id = pi.id
        AND dn.type IN ('exit', 'sale')
        AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
    ), 0)
) > 0.001;
GRANT SELECT ON public.purchase_batch_availability TO authenticated;

-- 5. FUNCTION: Recalculate Inventory (Pieces + Fictitious Check)
CREATE OR REPLACE FUNCTION public.recalculate_inventory_item(target_item_id UUID)
RETURNS VOID AS $$
DECLARE
    item_coeff NUMERIC(10,4);
    total_pieces NUMERIC(10,2) := 0;
BEGIN
    SELECT coefficient INTO item_coeff FROM public.inventory WHERE id = target_item_id;
    IF item_coeff IS NULL OR item_coeff = 0 THEN item_coeff := 1; END IF;

    -- Purchases
    SELECT COALESCE(SUM(pieces), 0) INTO total_pieces
    FROM public.purchase_items
    WHERE item_id = target_item_id;

    -- Movements (Exclude Fictitious)
    SELECT COALESCE(SUM(
        CASE 
            WHEN dn.type = 'entry' THEN dni.pieces
            WHEN dn.type IN ('exit', 'sale') THEN -dni.pieces
            ELSE 0
        END
    ), 0) + total_pieces INTO total_pieces
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
    WHERE dni.inventory_id = target_item_id
    AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL);

    -- Legacy
    SELECT COALESCE(SUM(
        CASE 
            WHEN type = 'load' THEN quantity / item_coeff
            WHEN type = 'unload' THEN -quantity / item_coeff
            ELSE 0
        END
    ), 0) + total_pieces INTO total_pieces
    FROM public.movements
    WHERE item_id = target_item_id;

    -- Update
    UPDATE public.inventory
    SET pieces = total_pieces,
        quantity = total_pieces * item_coeff
    WHERE id = target_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. TRIGGER: Movement Logic (Updates Pieces + Quantity, Respects Fictitious)
CREATE OR REPLACE FUNCTION public.handle_movement_logic()
RETURNS TRIGGER AS $$
DECLARE
  note_type TEXT;
  note_job_id UUID;
  item_coeff NUMERIC;
  new_is_fictitious BOOLEAN;
BEGIN
  -- Init
  SELECT coefficient INTO item_coeff FROM public.inventory WHERE id = COALESCE(NEW.inventory_id, OLD.inventory_id);
  IF item_coeff IS NULL OR item_coeff = 0 THEN item_coeff := 1; END IF;
  new_is_fictitious := COALESCE(NEW.is_fictitious, FALSE);

  -- INSERT
  IF TG_OP = 'INSERT' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = NEW.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          -- Job Inventory (Always update)
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
              VALUES (note_job_id, NEW.inventory_id, NEW.pieces, NEW.pieces * item_coeff)
              ON CONFLICT (job_id, item_id) 
              DO UPDATE SET pieces = job_inventory.pieces + EXCLUDED.pieces, quantity = (job_inventory.pieces + EXCLUDED.pieces) * item_coeff, updated_at = now();
          END IF;
          -- Main Inventory (Only if Real)
          IF NOT new_is_fictitious THEN
              UPDATE public.inventory SET pieces = pieces - NEW.pieces, quantity = (pieces - NEW.pieces) * item_coeff WHERE id = NEW.inventory_id;
          END IF;
          
      ELSIF note_type = 'entry' THEN
          -- Job Inventory
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET pieces = pieces - NEW.pieces, quantity = (pieces - NEW.pieces) * item_coeff, updated_at = now()
              WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
          END IF;
          -- Main Inventory
          IF NOT new_is_fictitious THEN
              UPDATE public.inventory SET pieces = pieces + NEW.pieces, quantity = (pieces + NEW.pieces) * item_coeff WHERE id = NEW.inventory_id;
          END IF;
      END IF;

  -- DELETE
  ELSIF TG_OP = 'DELETE' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = OLD.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET pieces = pieces - OLD.pieces, quantity = (pieces - OLD.pieces) * item_coeff WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          IF COALESCE(OLD.is_fictitious, FALSE) IS FALSE THEN
              UPDATE public.inventory SET pieces = pieces + OLD.pieces, quantity = (pieces + OLD.pieces) * item_coeff WHERE id = OLD.inventory_id;
          END IF;
      ELSIF note_type = 'entry' THEN
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET pieces = pieces + OLD.pieces, quantity = (pieces + OLD.pieces) * item_coeff WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          IF COALESCE(OLD.is_fictitious, FALSE) IS FALSE THEN
              UPDATE public.inventory SET pieces = pieces - OLD.pieces, quantity = (pieces - OLD.pieces) * item_coeff WHERE id = OLD.inventory_id;
          END IF;
      END IF;

  -- UPDATE
  ELSIF TG_OP = 'UPDATE' THEN
      -- Revert OLD
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = OLD.delivery_note_id;
      IF note_type IN ('exit', 'sale') THEN
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET pieces = pieces - OLD.pieces, quantity = (pieces - OLD.pieces) * item_coeff WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          IF COALESCE(OLD.is_fictitious, FALSE) IS FALSE THEN
              UPDATE public.inventory SET pieces = pieces + OLD.pieces, quantity = (pieces + OLD.pieces) * item_coeff WHERE id = OLD.inventory_id;
          END IF;
      ELSIF note_type = 'entry' THEN
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET pieces = pieces + OLD.pieces, quantity = (pieces + OLD.pieces) * item_coeff WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          IF COALESCE(OLD.is_fictitious, FALSE) IS FALSE THEN
              UPDATE public.inventory SET pieces = pieces - OLD.pieces, quantity = (pieces - OLD.pieces) * item_coeff WHERE id = OLD.inventory_id;
          END IF;
      END IF;

      -- Apply NEW
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = NEW.delivery_note_id;
      IF note_type IN ('exit', 'sale') THEN
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity) VALUES (note_job_id, NEW.inventory_id, NEW.pieces, NEW.pieces * item_coeff)
              ON CONFLICT (job_id, item_id) DO UPDATE SET pieces = job_inventory.pieces + NEW.pieces, quantity = (job_inventory.pieces + NEW.pieces) * item_coeff, updated_at = now();
          END IF;
          IF NOT new_is_fictitious THEN
              UPDATE public.inventory SET pieces = pieces - NEW.pieces, quantity = (pieces - NEW.pieces) * item_coeff WHERE id = NEW.inventory_id;
          END IF;
      ELSIF note_type = 'entry' THEN
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET pieces = pieces - NEW.pieces, quantity = (pieces - NEW.pieces) * item_coeff, updated_at = now()
              WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
          END IF;
          IF NOT new_is_fictitious THEN
              UPDATE public.inventory SET pieces = pieces + NEW.pieces, quantity = (pieces + NEW.pieces) * item_coeff WHERE id = NEW.inventory_id;
          END IF;
      END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RECALC ALL
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.inventory LOOP
        PERFORM public.recalculate_inventory_item(r.id);
    END LOOP;
END;
$$;