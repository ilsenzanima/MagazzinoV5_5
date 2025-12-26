-- Fix delete/update triggers to handle NULL pieces safely (2025-12-26)

-- 1. handle_movement_logic (Delivery Notes)
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
  
  -- Safe variables
  v_new_pieces NUMERIC;
  v_old_pieces NUMERIC;
  v_new_qty NUMERIC;
  v_old_qty NUMERIC;
BEGIN
  -- Get coefficient
  SELECT coefficient INTO item_coeff FROM public.inventory WHERE id = COALESCE(NEW.inventory_id, OLD.inventory_id);
  IF item_coeff IS NULL OR item_coeff = 0 THEN item_coeff := 1; END IF;
  
  -- Initialize safe variables
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
      new_is_fictitious := COALESCE(NEW.is_fictitious, FALSE);
      v_new_pieces := COALESCE(NEW.pieces, 0);
      v_new_qty := COALESCE(NEW.quantity, 0);
  END IF;
  
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
      old_is_fictitious := COALESCE(OLD.is_fictitious, FALSE);
      v_old_pieces := COALESCE(OLD.pieces, 0);
      v_old_qty := COALESCE(OLD.quantity, 0);
  END IF;

  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = NEW.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          -- Exit/Sale: Add to Job (if job exists), Subtract from Warehouse
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
              VALUES (note_job_id, NEW.inventory_id, v_new_pieces, v_new_qty)
              ON CONFLICT (job_id, item_id) 
              DO UPDATE SET 
                  pieces = job_inventory.pieces + EXCLUDED.pieces, 
                  quantity = job_inventory.quantity + EXCLUDED.quantity, 
                  updated_at = now();
          END IF;
          
          IF NOT new_is_fictitious THEN
              UPDATE public.inventory 
              SET pieces = pieces - v_new_pieces, 
                  quantity = quantity - v_new_qty 
              WHERE id = NEW.inventory_id;
          END IF;
          
      ELSIF note_type = 'entry' THEN
          -- Entry: Subtract from Job, Add to Warehouse
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory 
              SET pieces = pieces - v_new_pieces, 
                  quantity = quantity - v_new_qty, 
                  updated_at = now() 
              WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
          END IF;
          
          IF NOT new_is_fictitious THEN
              UPDATE public.inventory 
              SET pieces = pieces + v_new_pieces, 
                  quantity = quantity + v_new_qty 
              WHERE id = NEW.inventory_id;
          END IF;
      END IF;

  -- Handle DELETE
  ELSIF TG_OP = 'DELETE' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = OLD.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          -- Revert Exit: Subtract from Job, Add to Warehouse
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory 
              SET pieces = pieces - v_old_pieces, 
                  quantity = quantity - v_old_qty 
              WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          
          IF NOT old_is_fictitious THEN
              UPDATE public.inventory 
              SET pieces = pieces + v_old_pieces, 
                  quantity = quantity + v_old_qty 
              WHERE id = OLD.inventory_id;
          END IF;
          
      ELSIF note_type = 'entry' THEN
          -- Revert Entry: Add to Job, Subtract from Warehouse
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory 
              SET pieces = pieces + v_old_pieces, 
                  quantity = quantity + v_old_qty 
              WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          
          IF NOT old_is_fictitious THEN
              UPDATE public.inventory 
              SET pieces = pieces - v_old_pieces, 
                  quantity = quantity - v_old_qty 
              WHERE id = OLD.inventory_id;
          END IF;
      END IF;

  -- Handle UPDATE
  ELSIF TG_OP = 'UPDATE' THEN
      -- For updates, we use the recalculation function to be safe and consistent
      PERFORM public.recalculate_inventory_item(NEW.inventory_id);
      IF OLD.inventory_id <> NEW.inventory_id THEN
          PERFORM public.recalculate_inventory_item(OLD.inventory_id);
      END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- 2. handle_purchase_item_change (Purchases)
CREATE OR REPLACE FUNCTION public.handle_purchase_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item_coeff NUMERIC;
    v_job_id UUID;
    
    -- Safe variables
    v_new_pieces NUMERIC;
    v_old_pieces NUMERIC;
    v_new_qty NUMERIC;
    v_old_qty NUMERIC;
BEGIN
    -- Get coefficient
    SELECT coefficient INTO item_coeff FROM public.inventory WHERE id = COALESCE(NEW.item_id, OLD.item_id);
    IF item_coeff IS NULL OR item_coeff = 0 THEN item_coeff := 1; END IF;

    -- Get job_id from parent purchase
    IF TG_OP = 'DELETE' THEN
        SELECT job_id INTO v_job_id FROM public.purchases WHERE id = OLD.purchase_id;
        v_old_pieces := COALESCE(OLD.pieces, 0);
        v_old_qty := COALESCE(OLD.quantity, 0);
    ELSE
        SELECT job_id INTO v_job_id FROM public.purchases WHERE id = NEW.purchase_id;
        v_new_pieces := COALESCE(NEW.pieces, 0);
        v_new_qty := COALESCE(NEW.quantity, 0);
        
        IF TG_OP = 'UPDATE' THEN
             v_old_pieces := COALESCE(OLD.pieces, 0);
             v_old_qty := COALESCE(OLD.quantity, 0);
        END IF;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF v_job_id IS NOT NULL THEN
            -- Direct to Job Site -> Update Job Inventory
            INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
            VALUES (v_job_id, NEW.item_id, v_new_pieces, v_new_qty)
            ON CONFLICT (job_id, item_id) 
            DO UPDATE SET 
                pieces = job_inventory.pieces + EXCLUDED.pieces,
                quantity = job_inventory.quantity + EXCLUDED.quantity,
                updated_at = now();
        ELSE
            -- To Warehouse -> Update Main Inventory
            UPDATE public.inventory
            SET pieces = pieces + v_new_pieces,
                quantity = quantity + v_new_qty
            WHERE id = NEW.item_id;
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        IF v_job_id IS NOT NULL THEN
            -- Remove from Job Site
            UPDATE public.job_inventory
            SET pieces = pieces - v_old_pieces,
                quantity = quantity - v_old_qty,
                updated_at = now()
            WHERE job_id = v_job_id AND item_id = OLD.item_id;
        ELSE
            -- Remove from Warehouse
            UPDATE public.inventory
            SET pieces = pieces - v_old_pieces,
                quantity = quantity - v_old_qty
            WHERE id = OLD.item_id;
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        IF v_job_id IS NOT NULL THEN
             UPDATE public.job_inventory
             SET pieces = pieces - v_old_pieces + v_new_pieces,
                 quantity = quantity - v_old_qty + v_new_qty,
                 updated_at = now()
             WHERE job_id = v_job_id AND item_id = NEW.item_id;
        ELSE
             UPDATE public.inventory
             SET pieces = pieces - v_old_pieces + v_new_pieces,
                 quantity = quantity - v_old_qty + v_new_qty
             WHERE id = NEW.item_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;
