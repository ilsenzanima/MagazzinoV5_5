-- 1. Ensure Inventory Quantity is valid
UPDATE public.inventory SET quantity = 0 WHERE quantity IS NULL;
ALTER TABLE public.inventory ALTER COLUMN quantity SET DEFAULT 0;
ALTER TABLE public.inventory ALTER COLUMN quantity SET NOT NULL;

-- 1b. Fix purchase_items with 0 quantity but valid pieces (Critical for legacy data)
UPDATE public.purchase_items
SET quantity = pieces * coefficient
WHERE (quantity IS NULL OR quantity = 0) AND pieces > 0;

-- 2. Improved Purchase Trigger (Robust & Handles Updates)
CREATE OR REPLACE FUNCTION public.handle_purchase_item_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.inventory
    SET quantity = quantity + NEW.quantity
    WHERE id = NEW.item_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.inventory
    SET quantity = quantity - OLD.quantity
    WHERE id = OLD.item_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only update if quantity changed
    IF OLD.quantity <> NEW.quantity THEN
        UPDATE public.inventory
        SET quantity = quantity - OLD.quantity + NEW.quantity
        WHERE id = NEW.item_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_purchase_item_change ON public.purchase_items;
CREATE TRIGGER on_purchase_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_purchase_item_change();

-- 3. Improved Movement Trigger (Adding UPDATE support)
CREATE OR REPLACE FUNCTION public.handle_movement_logic()
RETURNS TRIGGER AS $$
DECLARE
  note_type TEXT;
  note_job_id UUID;
  current_job_qty NUMERIC;
  diff NUMERIC;
BEGIN
  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = NEW.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          -- Update Job Inventory
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              INSERT INTO public.job_inventory (job_id, item_id, quantity)
              VALUES (note_job_id, NEW.inventory_id, NEW.quantity)
              ON CONFLICT (job_id, item_id) 
              DO UPDATE SET quantity = job_inventory.quantity + EXCLUDED.quantity, updated_at = now();
          END IF;
          -- Update Main Inventory
          UPDATE public.inventory SET quantity = quantity - NEW.quantity WHERE id = NEW.inventory_id;
          
      ELSIF note_type = 'entry' THEN
          -- Update Job Inventory
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET quantity = quantity - NEW.quantity, updated_at = now()
              WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
          END IF;
          -- Update Main Inventory
          UPDATE public.inventory SET quantity = quantity + NEW.quantity WHERE id = NEW.inventory_id;
      END IF;

  -- Handle DELETE
  ELSIF TG_OP = 'DELETE' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = OLD.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET quantity = quantity - OLD.quantity WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          UPDATE public.inventory SET quantity = quantity + OLD.quantity WHERE id = OLD.inventory_id;
          
      ELSIF note_type = 'entry' THEN
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET quantity = quantity + OLD.quantity WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          UPDATE public.inventory SET quantity = quantity - OLD.quantity WHERE id = OLD.inventory_id;
      END IF;

  -- Handle UPDATE
  ELSIF TG_OP = 'UPDATE' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = NEW.delivery_note_id;
      diff := NEW.quantity - OLD.quantity;
      
      IF diff <> 0 THEN
          IF note_type IN ('exit', 'sale') THEN
              IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
                  INSERT INTO public.job_inventory (job_id, item_id, quantity)
                  VALUES (note_job_id, NEW.inventory_id, diff)
                  ON CONFLICT (job_id, item_id) 
                  DO UPDATE SET quantity = job_inventory.quantity + diff, updated_at = now();
              END IF;
              UPDATE public.inventory SET quantity = quantity - diff WHERE id = NEW.inventory_id;
              
          ELSIF note_type = 'entry' THEN
              IF note_job_id IS NOT NULL THEN
                  UPDATE public.job_inventory SET quantity = quantity - diff, updated_at = now()
                  WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
              END IF;
              UPDATE public.inventory SET quantity = quantity + diff WHERE id = NEW.inventory_id;
          END IF;
      END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_delivery_note_item_change ON public.delivery_note_items;
CREATE TRIGGER on_delivery_note_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_note_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_movement_logic();

-- 4. Recalculation Logic (Source of Truth)
CREATE OR REPLACE FUNCTION public.recalculate_inventory_item(target_item_id UUID)
RETURNS VOID AS $$
DECLARE
    total_purchased NUMERIC(10,2) := 0;
    total_delivered NUMERIC(10,2) := 0;
    total_legacy NUMERIC(10,2) := 0;
    final_quantity NUMERIC(10,2) := 0;
BEGIN
    -- Sum Purchases
    SELECT COALESCE(SUM(quantity), 0) INTO total_purchased
    FROM public.purchase_items
    WHERE item_id = target_item_id;

    -- Sum Delivery Notes
    -- Entry = + (Back to warehouse)
    -- Exit/Sale = - (Out of warehouse)
    SELECT COALESCE(SUM(
        CASE 
            WHEN dn.type = 'entry' THEN dni.quantity
            WHEN dn.type IN ('exit', 'sale') THEN -dni.quantity
            ELSE 0
        END
    ), 0) INTO total_delivered
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
    WHERE dni.inventory_id = target_item_id;

    -- Sum Legacy Movements
    SELECT COALESCE(SUM(
        CASE 
            WHEN type = 'load' THEN quantity
            WHEN type = 'unload' THEN -quantity
            ELSE 0
        END
    ), 0) INTO total_legacy
    FROM public.movements
    WHERE item_id = target_item_id;

    -- Final
    final_quantity := total_purchased + total_delivered + total_legacy;

    -- Update Inventory
    UPDATE public.inventory
    SET quantity = final_quantity
    WHERE id = target_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Run Recalculation NOW for all items
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.inventory LOOP
        PERFORM public.recalculate_inventory_item(r.id);
    END LOOP;
END;
$$;

-- 6. Recalculate Job Inventory
TRUNCATE TABLE public.job_inventory;
INSERT INTO public.job_inventory (job_id, item_id, quantity)
SELECT 
    dn.job_id,
    dni.inventory_id,
    SUM(
        CASE 
            WHEN dn.type = 'exit' THEN dni.quantity 
            WHEN dn.type = 'entry' THEN -dni.quantity
            ELSE 0 
        END
    ) as quantity
FROM public.delivery_note_items dni
JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
WHERE dn.job_id IS NOT NULL AND dn.type IN ('entry', 'exit')
GROUP BY dn.job_id, dni.inventory_id
HAVING SUM(
    CASE 
        WHEN dn.type = 'exit' THEN dni.quantity 
        WHEN dn.type = 'entry' THEN -dni.quantity
        ELSE 0 
    END
) > 0;
