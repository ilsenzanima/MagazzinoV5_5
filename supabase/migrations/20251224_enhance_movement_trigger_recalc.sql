-- Enhanced Movement Trigger to Force Full Recalculation on Changes
-- This ensures that deleting a delivery note (or item) correctly restores inventory
-- by recalculating from scratch based on all remaining transactions.

CREATE OR REPLACE FUNCTION public.handle_movement_logic()
RETURNS TRIGGER AS $$
DECLARE
  note_type TEXT;
  note_job_id UUID;
  diff NUMERIC;
  target_item_id UUID;
BEGIN
  -- Determine target item for recalculation
  IF TG_OP = 'DELETE' THEN
      target_item_id := OLD.inventory_id;
  ELSE
      target_item_id := NEW.inventory_id;
  END IF;

  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = NEW.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          -- Update Job Inventory (Delta logic kept for Job Inventory as it has no recalculation function yet)
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              INSERT INTO public.job_inventory (job_id, item_id, quantity)
              VALUES (note_job_id, NEW.inventory_id, NEW.quantity)
              ON CONFLICT (job_id, item_id) 
              DO UPDATE SET quantity = job_inventory.quantity + EXCLUDED.quantity, updated_at = now();
          END IF;
          -- Main Inventory will be recalculated at the end
          
      ELSIF note_type = 'entry' THEN
          -- Update Job Inventory
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET quantity = quantity - NEW.quantity, updated_at = now()
              WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
          END IF;
      END IF;

  -- Handle DELETE
  ELSIF TG_OP = 'DELETE' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = OLD.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET quantity = quantity - OLD.quantity WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          
      ELSIF note_type = 'entry' THEN
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET quantity = quantity + OLD.quantity WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
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
              
          ELSIF note_type = 'entry' THEN
              IF note_job_id IS NOT NULL THEN
                  UPDATE public.job_inventory SET quantity = quantity - diff, updated_at = now()
                  WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
              END IF;
          END IF;
      END IF;
  END IF;

  -- FORCE RECALCULATION of Main Inventory
  -- This ensures absolute correctness by summing all purchase history and movement history
  PERFORM public.recalculate_inventory_item(target_item_id);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
