-- 1. Add is_fictitious column to delivery_note_items
ALTER TABLE public.delivery_note_items 
ADD COLUMN IF NOT EXISTS is_fictitious BOOLEAN DEFAULT FALSE;

-- 2. Update Trigger Function to handle is_fictitious
CREATE OR REPLACE FUNCTION public.handle_movement_logic()
RETURNS TRIGGER AS $$
DECLARE
  note_type TEXT;
  note_job_id UUID;
  diff NUMERIC;
BEGIN
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
          IF NOT NEW.is_fictitious THEN
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
          IF NOT NEW.is_fictitious THEN
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
          IF NOT OLD.is_fictitious THEN
              UPDATE public.inventory SET quantity = quantity + OLD.quantity WHERE id = OLD.inventory_id;
          END IF;
          
      ELSIF note_type = 'entry' THEN
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET quantity = quantity + OLD.quantity WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          
          -- Restore Inventory ONLY IF NOT FICTITIOUS
          IF NOT OLD.is_fictitious THEN
              UPDATE public.inventory SET quantity = quantity - OLD.quantity WHERE id = OLD.inventory_id;
          END IF;
      END IF;

  -- Handle UPDATE
  ELSIF TG_OP = 'UPDATE' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = NEW.delivery_note_id;
      diff := NEW.quantity - OLD.quantity;
      
      -- If fictitious status changed, it's complex. Let's handle simple quantity change first.
      -- If both are NOT fictitious:
      IF NOT NEW.is_fictitious AND NOT OLD.is_fictitious THEN
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
      
      -- If it WAS fictitious and NOW is NOT (We need to apply the full effect of NEW quantity)
      ELSIF OLD.is_fictitious AND NOT NEW.is_fictitious THEN
          -- Apply effect of NEW.quantity to inventory
           IF note_type IN ('exit', 'sale') THEN
              UPDATE public.inventory SET quantity = quantity - NEW.quantity WHERE id = NEW.inventory_id;
           ELSIF note_type = 'entry' THEN
              UPDATE public.inventory SET quantity = quantity + NEW.quantity WHERE id = NEW.inventory_id;
           END IF;
           -- Job inventory handles quantity change normally (it's always affected)
           IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
                INSERT INTO public.job_inventory (job_id, item_id, quantity)
                VALUES (note_job_id, NEW.inventory_id, diff)
                ON CONFLICT (job_id, item_id) 
                DO UPDATE SET quantity = job_inventory.quantity + diff, updated_at = now();
           ELSIF note_type = 'entry' AND note_job_id IS NOT NULL THEN
                UPDATE public.job_inventory SET quantity = quantity - diff, updated_at = now()
                WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
           END IF;

      -- If it WAS NOT fictitious and NOW IS (We need to revert the effect of OLD quantity)
      ELSIF NOT OLD.is_fictitious AND NEW.is_fictitious THEN
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
           
      -- If BOTH are fictitious
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

-- 3. Re-create trigger just in case
DROP TRIGGER IF EXISTS on_delivery_note_item_change ON public.delivery_note_items;
CREATE TRIGGER on_delivery_note_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_note_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_movement_logic();
