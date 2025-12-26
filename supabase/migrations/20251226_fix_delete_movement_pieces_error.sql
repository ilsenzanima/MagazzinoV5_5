-- Fix for "null value in column pieces" error during deletion of legacy movements
-- This replaces handle_movement_logic with a version that safely handles NULL pieces by recalculating them from quantity/coefficient

CREATE OR REPLACE FUNCTION public.handle_movement_logic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  note_type TEXT;
  note_job_id UUID;
  item_coeff NUMERIC;
  new_is_fictitious BOOLEAN;
  old_is_fictitious BOOLEAN;
  
  safe_old_pieces NUMERIC;
  safe_new_pieces NUMERIC;
BEGIN
  -- Determine coefficient
  SELECT coefficient INTO item_coeff FROM public.inventory WHERE id = COALESCE(NEW.inventory_id, OLD.inventory_id);
  IF item_coeff IS NULL OR item_coeff = 0 THEN item_coeff := 1; END IF;
  
  -- Calculate Safe Pieces (Handle NULLs)
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
      old_is_fictitious := COALESCE(OLD.is_fictitious, FALSE);
      -- Fallback to quantity / coeff if pieces is null, or 0 if everything is missing
      safe_old_pieces := COALESCE(OLD.pieces, CASE WHEN item_coeff <> 0 THEN ROUND(OLD.quantity / item_coeff, 2) ELSE 0 END, 0);
  END IF;
  
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
      new_is_fictitious := COALESCE(NEW.is_fictitious, FALSE);
      safe_new_pieces := COALESCE(NEW.pieces, CASE WHEN item_coeff <> 0 THEN ROUND(NEW.quantity / item_coeff, 2) ELSE 0 END, 0);
  END IF;

  -- INSERT LOGIC
  IF TG_OP = 'INSERT' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = NEW.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          -- Warehouse -> Job (Exit)
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
              VALUES (note_job_id, NEW.inventory_id, safe_new_pieces, safe_new_pieces * item_coeff)
              ON CONFLICT (job_id, item_id) 
              DO UPDATE SET pieces = job_inventory.pieces + EXCLUDED.pieces, quantity = (job_inventory.pieces + EXCLUDED.pieces) * item_coeff, updated_at = now();
          END IF;
          -- Subtract from Main Inventory
          IF NOT new_is_fictitious THEN
              UPDATE public.inventory SET pieces = pieces - safe_new_pieces, quantity = (pieces - safe_new_pieces) * item_coeff WHERE id = NEW.inventory_id;
          END IF;

      ELSIF note_type = 'entry' THEN
          -- Job -> Warehouse (Entry)
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET pieces = pieces - safe_new_pieces, quantity = (pieces - safe_new_pieces) * item_coeff, updated_at = now() WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
          END IF;
          -- Add to Main Inventory
          IF NOT new_is_fictitious THEN
              UPDATE public.inventory SET pieces = pieces + safe_new_pieces, quantity = (pieces + safe_new_pieces) * item_coeff WHERE id = NEW.inventory_id;
          END IF;
      END IF;

  -- DELETE LOGIC
  ELSIF TG_OP = 'DELETE' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = OLD.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          -- Revert Exit: Remove from Job, Add to Warehouse
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET pieces = pieces - safe_old_pieces, quantity = (pieces - safe_old_pieces) * item_coeff WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          IF NOT old_is_fictitious THEN
              UPDATE public.inventory SET pieces = pieces + safe_old_pieces, quantity = (pieces + safe_old_pieces) * item_coeff WHERE id = OLD.inventory_id;
          END IF;

      ELSIF note_type = 'entry' THEN
          -- Revert Entry: Add to Job, Remove from Warehouse
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET pieces = pieces + safe_old_pieces, quantity = (pieces + safe_old_pieces) * item_coeff WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          IF NOT old_is_fictitious THEN
              UPDATE public.inventory SET pieces = pieces - safe_old_pieces, quantity = (pieces - safe_old_pieces) * item_coeff WHERE id = OLD.inventory_id;
          END IF;
      END IF;

  -- UPDATE LOGIC
  ELSIF TG_OP = 'UPDATE' THEN
      -- Full recalculation is safest for updates to handle all edge cases
      PERFORM public.recalculate_inventory_item(NEW.inventory_id);
      IF OLD.inventory_id <> NEW.inventory_id THEN
          PERFORM public.recalculate_inventory_item(OLD.inventory_id);
      END IF;
  END IF;

  RETURN NULL;
END;
$$;
