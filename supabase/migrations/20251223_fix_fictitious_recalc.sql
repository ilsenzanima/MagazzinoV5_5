-- Fix recalculate_inventory_item to exclude fictitious items
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
    -- EXCLUDE Fictitious items
    SELECT COALESCE(SUM(
        CASE 
            WHEN dn.type = 'entry' THEN dni.quantity
            WHEN dn.type IN ('exit', 'sale') THEN -dni.quantity
            ELSE 0
        END
    ), 0) INTO total_delivered
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
    WHERE dni.inventory_id = target_item_id
    AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL);

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

-- Update Trigger Function to handle is_fictitious robustly (with COALESCE)
CREATE OR REPLACE FUNCTION public.handle_movement_logic()
RETURNS TRIGGER AS $$
DECLARE
  note_type TEXT;
  note_job_id UUID;
  diff NUMERIC;
  new_is_fictitious BOOLEAN;
  old_is_fictitious BOOLEAN;
BEGIN
  -- Safe boolean values
  new_is_fictitious := COALESCE(NEW.is_fictitious, FALSE);
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
      old_is_fictitious := COALESCE(OLD.is_fictitious, FALSE);
  END IF;

  -- Logic for INSERT
  IF TG_OP = 'INSERT' THEN
      -- Get parent note details
      SELECT type, job_id INTO note_type, note_job_id
      FROM public.delivery_notes
      WHERE id = NEW.delivery_note_id;

      IF note_type IN ('exit', 'sale') THEN
          -- B. Update Job Inventory (Only for Exits to Jobs)
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              INSERT INTO public.job_inventory (job_id, item_id, quantity)
              VALUES (note_job_id, NEW.inventory_id, NEW.quantity)
              ON CONFLICT (job_id, item_id) 
              DO UPDATE SET 
                  quantity = job_inventory.quantity + EXCLUDED.quantity,
                  updated_at = now();
          END IF;

          -- C. Update Main Inventory (Decrease) - ONLY IF NOT FICTITIOUS
          IF NOT new_is_fictitious THEN
              UPDATE public.inventory
              SET quantity = quantity - NEW.quantity
              WHERE id = NEW.inventory_id;
          END IF;
          
      ELSIF note_type = 'entry' THEN
          -- A. Update Job Inventory (Decrease if coming from Job)
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory
              SET quantity = quantity - NEW.quantity,
                  updated_at = now()
              WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
          END IF;

          -- B. Update Main Inventory (Increase) - ONLY IF NOT FICTITIOUS
          IF NOT new_is_fictitious THEN
              UPDATE public.inventory
              SET quantity = quantity + NEW.quantity
              WHERE id = NEW.inventory_id;
          END IF;
      END IF;

  -- Logic for DELETE
  ELSIF TG_OP = 'DELETE' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = OLD.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET quantity = quantity - OLD.quantity WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          
          -- Restore Inventory ONLY IF NOT FICTITIOUS
          IF NOT old_is_fictitious THEN
              UPDATE public.inventory SET quantity = quantity + OLD.quantity WHERE id = OLD.inventory_id;
          END IF;
          
      ELSIF note_type = 'entry' THEN
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET quantity = quantity + OLD.quantity WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          
          -- Restore Inventory ONLY IF NOT FICTITIOUS
          IF NOT old_is_fictitious THEN
              UPDATE public.inventory SET quantity = quantity - OLD.quantity WHERE id = OLD.inventory_id;
          END IF;
      END IF;

  -- Handle UPDATE
  ELSIF TG_OP = 'UPDATE' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = NEW.delivery_note_id;
      diff := NEW.quantity - OLD.quantity;
      
      -- Case 1: Both Real
      IF NOT new_is_fictitious AND NOT old_is_fictitious THEN
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
      
      -- Case 2: Changed from Fictitious to Real
      ELSIF old_is_fictitious AND NOT new_is_fictitious THEN
           -- Apply effect of NEW.quantity to inventory
           IF note_type IN ('exit', 'sale') THEN
              UPDATE public.inventory SET quantity = quantity - NEW.quantity WHERE id = NEW.inventory_id;
           ELSIF note_type = 'entry' THEN
              UPDATE public.inventory SET quantity = quantity + NEW.quantity WHERE id = NEW.inventory_id;
           END IF;
           -- Job inventory handles quantity change normally
           IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
                INSERT INTO public.job_inventory (job_id, item_id, quantity)
                VALUES (note_job_id, NEW.inventory_id, diff)
                ON CONFLICT (job_id, item_id) 
                DO UPDATE SET quantity = job_inventory.quantity + diff, updated_at = now();
           ELSIF note_type = 'entry' AND note_job_id IS NOT NULL THEN
                UPDATE public.job_inventory SET quantity = quantity - diff, updated_at = now()
                WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
           END IF;

      -- Case 3: Changed from Real to Fictitious
      ELSIF NOT old_is_fictitious AND new_is_fictitious THEN
           -- Revert effect of OLD.quantity on inventory
           IF note_type IN ('exit', 'sale') THEN
              UPDATE public.inventory SET quantity = quantity + OLD.quantity WHERE id = OLD.inventory_id;
           ELSIF note_type = 'entry' THEN
              UPDATE public.inventory SET quantity = quantity - OLD.quantity WHERE id = OLD.inventory_id;
           END IF;
           -- Job inventory handles quantity change normally
           IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
                INSERT INTO public.job_inventory (job_id, item_id, quantity)
                VALUES (note_job_id, NEW.inventory_id, diff)
                ON CONFLICT (job_id, item_id) 
                DO UPDATE SET quantity = job_inventory.quantity + diff, updated_at = now();
           ELSIF note_type = 'entry' AND note_job_id IS NOT NULL THEN
                UPDATE public.job_inventory SET quantity = quantity - diff, updated_at = now()
                WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
           END IF;
           
      -- Case 4: Both Fictitious
      ELSE
           -- Only Job Inventory changes
           IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
                INSERT INTO public.job_inventory (job_id, item_id, quantity)
                VALUES (note_job_id, NEW.inventory_id, diff)
                ON CONFLICT (job_id, item_id) 
                DO UPDATE SET quantity = job_inventory.quantity + diff, updated_at = now();
           ELSIF note_type = 'entry' AND note_job_id IS NOT NULL THEN
                UPDATE public.job_inventory SET quantity = quantity - diff, updated_at = now()
                WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
           END IF;
      END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger to use the new function
DROP TRIGGER IF EXISTS on_delivery_note_item_change ON public.delivery_note_items;
CREATE TRIGGER on_delivery_note_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_note_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_movement_logic();

-- Update purchase_batch_availability view to EXCLUDE fictitious movements from usage
DROP VIEW IF EXISTS public.purchase_batch_availability;

CREATE OR REPLACE VIEW public.purchase_batch_availability AS
SELECT 
    pi.id as purchase_item_id,
    pi.item_id,
    p.delivery_note_number as purchase_ref,
    p.created_at as purchase_date,
    
    -- Cost Info
    pi.price as unit_price,
    pi.coefficient as coefficient,

    -- Quantity
    pi.quantity as original_quantity,
    pi.quantity - COALESCE((
        SELECT SUM(dni.quantity)
        FROM public.delivery_note_items dni
        JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
        WHERE dni.purchase_item_id = pi.id
        AND dn.type IN ('exit', 'sale')
        AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL) -- Exclude fictitious
    ), 0) as remaining_quantity,

    -- Pieces
    pi.pieces as original_pieces,
    pi.pieces - COALESCE((
        SELECT SUM(dni.pieces)
        FROM public.delivery_note_items dni
        JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
        WHERE dni.purchase_item_id = pi.id
        AND dn.type IN ('exit', 'sale')
        AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL) -- Exclude fictitious
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
        AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL) -- Exclude fictitious
    ), 0)
) > 0.001; -- Use pieces for availability check

GRANT SELECT ON public.purchase_batch_availability TO authenticated;

-- Run Recalculation NOW for all items to fix existing data
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.inventory LOOP
        PERFORM public.recalculate_inventory_item(r.id);
    END LOOP;
END;
$$;
