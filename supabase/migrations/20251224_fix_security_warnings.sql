-- Fix Security Advisor Warnings: Function Search Path Mutable
-- We add SET search_path = public; to SECURITY DEFINER functions.
-- We also MERGE logic from 2024 (Pieces) and 2025 (Fictitious) to ensure correctness.

-- 1. handle_delivery_note_deletion
CREATE OR REPLACE FUNCTION public.handle_delivery_note_deletion()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    is_fictitious_val BOOLEAN;
BEGIN
    SET search_path = public;
    -- Iterate over all items in this note
    FOR item IN SELECT * FROM public.delivery_note_items WHERE delivery_note_id = OLD.id LOOP
        
        is_fictitious_val := COALESCE(item.is_fictitious, FALSE);

        IF OLD.type IN ('exit', 'sale') THEN
            -- 1. Restore Job Inventory (if applicable)
            -- If it was an exit TO a job, deleting it means removing it FROM the job
            IF OLD.type = 'exit' AND OLD.job_id IS NOT NULL THEN
                UPDATE public.job_inventory 
                SET quantity = quantity - item.quantity,
                    pieces = pieces - item.pieces,
                    updated_at = now()
                WHERE job_id = OLD.job_id AND item_id = item.inventory_id;
            END IF;
            
            -- 2. Restore Main Inventory (Increase back) - ONLY IF NOT FICTITIOUS
            -- If it was an exit FROM warehouse, deleting it means putting it BACK to warehouse
            IF NOT is_fictitious_val THEN
                UPDATE public.inventory 
                SET quantity = quantity + item.quantity,
                    pieces = pieces + item.pieces
                WHERE id = item.inventory_id;
            END IF;
            
        ELSIF OLD.type = 'entry' THEN
            -- 1. Restore Job Inventory (if applicable)
            -- If it was an entry FROM a job (return), deleting it means putting it BACK to the job
            IF OLD.job_id IS NOT NULL THEN
                UPDATE public.job_inventory 
                SET quantity = quantity + item.quantity,
                    pieces = pieces + item.pieces,
                    updated_at = now()
                WHERE job_id = OLD.job_id AND item_id = item.inventory_id;
            END IF;
            
            -- 2. Restore Main Inventory (Decrease back) - ONLY IF NOT FICTITIOUS
            -- If it was an entry INTO warehouse, deleting it means removing it FROM warehouse
            IF NOT is_fictitious_val THEN
                UPDATE public.inventory 
                SET quantity = quantity - item.quantity,
                    pieces = pieces - item.pieces
                WHERE id = item.inventory_id;
            END IF;
        END IF;
    END LOOP;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. handle_purchase_item_change (Piece-Driven from 20240116)
CREATE OR REPLACE FUNCTION public.handle_purchase_item_change()
RETURNS TRIGGER AS $$
DECLARE
    item_coeff NUMERIC;
BEGIN
    SET search_path = public;
    SELECT coefficient INTO item_coeff FROM public.inventory WHERE id = COALESCE(NEW.item_id, OLD.item_id);
    IF item_coeff IS NULL OR item_coeff = 0 THEN item_coeff := 1; END IF;

    IF TG_OP = 'INSERT' THEN
        UPDATE public.inventory
        SET pieces = pieces + NEW.pieces,
            quantity = (pieces + NEW.pieces) * item_coeff
        WHERE id = NEW.item_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.inventory
        SET pieces = pieces - OLD.pieces,
            quantity = (pieces - OLD.pieces) * item_coeff
        WHERE id = OLD.item_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.pieces <> NEW.pieces THEN
            UPDATE public.inventory
            SET pieces = pieces - OLD.pieces + NEW.pieces,
                quantity = (pieces - OLD.pieces + NEW.pieces) * item_coeff
            WHERE id = NEW.item_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. recalculate_inventory_item (MERGED: Pieces + Fictitious)
CREATE OR REPLACE FUNCTION public.recalculate_inventory_item(target_item_id UUID)
RETURNS VOID AS $$
DECLARE
    item_coeff NUMERIC(10,4);
    total_pieces NUMERIC(10,2) := 0;
BEGIN
    SET search_path = public;
    
    SELECT coefficient INTO item_coeff FROM public.inventory WHERE id = target_item_id;
    IF item_coeff IS NULL OR item_coeff = 0 THEN item_coeff := 1; END IF;

    -- Sum Purchases (Pieces)
    SELECT COALESCE(SUM(pieces), 0) INTO total_pieces
    FROM public.purchase_items
    WHERE item_id = target_item_id;

    -- Sum Delivery Notes (Pieces)
    -- Entry = + (Back to warehouse)
    -- Exit/Sale = - (Out of warehouse)
    -- EXCLUDE Fictitious items
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

    -- Sum Legacy Movements (Pieces calculated from quantity/coeff)
    SELECT COALESCE(SUM(
        CASE 
            WHEN type = 'load' THEN quantity / item_coeff
            WHEN type = 'unload' THEN -quantity / item_coeff
            ELSE 0
        END
    ), 0) + total_pieces INTO total_pieces
    FROM public.movements
    WHERE item_id = target_item_id;

    -- Update Inventory
    UPDATE public.inventory
    SET pieces = total_pieces,
        quantity = total_pieces * item_coeff
    WHERE id = target_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. handle_movement_logic (MERGED: Pieces + Fictitious)
CREATE OR REPLACE FUNCTION public.handle_movement_logic()
RETURNS TRIGGER AS $$
DECLARE
  note_type TEXT;
  note_job_id UUID;
  diff_pieces NUMERIC;
  item_coeff NUMERIC;
  new_is_fictitious BOOLEAN;
  old_is_fictitious BOOLEAN;
BEGIN
  SET search_path = public;
  
  -- Init
  SELECT coefficient INTO item_coeff FROM public.inventory WHERE id = COALESCE(NEW.inventory_id, OLD.inventory_id);
  IF item_coeff IS NULL OR item_coeff = 0 THEN item_coeff := 1; END IF;
  
  new_is_fictitious := COALESCE(NEW.is_fictitious, FALSE);
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
      old_is_fictitious := COALESCE(OLD.is_fictitious, FALSE);
  END IF;

  -- Logic for INSERT
  IF TG_OP = 'INSERT' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = NEW.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          -- B. Update Job Inventory (Only for Exits to Jobs) - Always update job inventory regardless of fictitious
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
              VALUES (note_job_id, NEW.inventory_id, NEW.pieces, NEW.pieces * item_coeff)
              ON CONFLICT (job_id, item_id) 
              DO UPDATE SET 
                  pieces = job_inventory.pieces + EXCLUDED.pieces,
                  quantity = (job_inventory.pieces + EXCLUDED.pieces) * item_coeff,
                  updated_at = now();
          END IF;

          -- C. Update Main Inventory (Decrease) - ONLY IF NOT FICTITIOUS
          IF NOT new_is_fictitious THEN
              UPDATE public.inventory
              SET pieces = pieces - NEW.pieces,
                  quantity = (pieces - NEW.pieces) * item_coeff
              WHERE id = NEW.inventory_id;
          END IF;
          
      ELSIF note_type = 'entry' THEN
          -- A. Update Job Inventory (Decrease if coming from Job)
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory
              SET pieces = pieces - NEW.pieces,
                  quantity = (pieces - NEW.pieces) * item_coeff,
                  updated_at = now()
              WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
          END IF;

          -- B. Update Main Inventory (Increase) - ONLY IF NOT FICTITIOUS
          IF NOT new_is_fictitious THEN
              UPDATE public.inventory
              SET pieces = pieces + NEW.pieces,
                  quantity = (pieces + NEW.pieces) * item_coeff
              WHERE id = NEW.inventory_id;
          END IF;
      END IF;

  -- Logic for DELETE
  ELSIF TG_OP = 'DELETE' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = OLD.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory 
              SET pieces = pieces - OLD.pieces, 
                  quantity = (pieces - OLD.pieces) * item_coeff 
              WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          
          -- Restore Inventory ONLY IF NOT FICTITIOUS
          IF NOT old_is_fictitious THEN
              UPDATE public.inventory 
              SET pieces = pieces + OLD.pieces, 
                  quantity = (pieces + OLD.pieces) * item_coeff 
              WHERE id = OLD.inventory_id;
          END IF;
          
      ELSIF note_type = 'entry' THEN
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory 
              SET pieces = pieces + OLD.pieces, 
                  quantity = (pieces + OLD.pieces) * item_coeff 
              WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          
          -- Restore Inventory ONLY IF NOT FICTITIOUS
          IF NOT old_is_fictitious THEN
              UPDATE public.inventory 
              SET pieces = pieces - OLD.pieces, 
                  quantity = (pieces - OLD.pieces) * item_coeff 
              WHERE id = OLD.inventory_id;
          END IF;
      END IF;

  -- Handle UPDATE
  ELSIF TG_OP = 'UPDATE' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = NEW.delivery_note_id;
      diff_pieces := NEW.pieces - OLD.pieces;
      
      -- Case 1: Both Real
      IF NOT new_is_fictitious AND NOT old_is_fictitious THEN
          IF diff_pieces <> 0 THEN
              IF note_type IN ('exit', 'sale') THEN
                  IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
                      INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
                      VALUES (note_job_id, NEW.inventory_id, diff_pieces, diff_pieces * item_coeff)
                      ON CONFLICT (job_id, item_id) 
                      DO UPDATE SET pieces = job_inventory.pieces + diff_pieces, quantity = (job_inventory.pieces + diff_pieces) * item_coeff, updated_at = now();
                  END IF;
                  UPDATE public.inventory 
                  SET pieces = pieces - diff_pieces, 
                      quantity = (pieces - diff_pieces) * item_coeff 
                  WHERE id = NEW.inventory_id;
                  
              ELSIF note_type = 'entry' THEN
                  IF note_job_id IS NOT NULL THEN
                      UPDATE public.job_inventory 
                      SET pieces = pieces - diff_pieces, 
                          quantity = (pieces - diff_pieces) * item_coeff,
                          updated_at = now()
                      WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
                  END IF;
                  UPDATE public.inventory 
                  SET pieces = pieces + diff_pieces, 
                      quantity = (pieces + diff_pieces) * item_coeff 
                  WHERE id = NEW.inventory_id;
              END IF;
          END IF;
      
      -- Case 2: Changed from Fictitious to Real
      ELSIF old_is_fictitious AND NOT new_is_fictitious THEN
           -- Apply effect of NEW.pieces to inventory
           IF note_type IN ('exit', 'sale') THEN
              UPDATE public.inventory 
              SET pieces = pieces - NEW.pieces, 
                  quantity = (pieces - NEW.pieces) * item_coeff 
              WHERE id = NEW.inventory_id;
           ELSIF note_type = 'entry' THEN
              UPDATE public.inventory 
              SET pieces = pieces + NEW.pieces, 
                  quantity = (pieces + NEW.pieces) * item_coeff 
              WHERE id = NEW.inventory_id;
           END IF;
           -- Job inventory handles quantity change normally (diff)
           IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
                INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
                VALUES (note_job_id, NEW.inventory_id, diff_pieces, diff_pieces * item_coeff)
                ON CONFLICT (job_id, item_id) 
                DO UPDATE SET pieces = job_inventory.pieces + diff_pieces, quantity = (job_inventory.pieces + diff_pieces) * item_coeff, updated_at = now();
           ELSIF note_type = 'entry' AND note_job_id IS NOT NULL THEN
                UPDATE public.job_inventory 
                SET pieces = pieces - diff_pieces, 
                    quantity = (pieces - diff_pieces) * item_coeff, 
                    updated_at = now()
                WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
           END IF;

      -- Case 3: Changed from Real to Fictitious
      ELSIF NOT old_is_fictitious AND new_is_fictitious THEN
           -- Revert effect of OLD.pieces on inventory
           IF note_type IN ('exit', 'sale') THEN
              UPDATE public.inventory 
              SET pieces = pieces + OLD.pieces, 
                  quantity = (pieces + OLD.pieces) * item_coeff 
              WHERE id = OLD.inventory_id;
           ELSIF note_type = 'entry' THEN
              UPDATE public.inventory 
              SET pieces = pieces - OLD.pieces, 
                  quantity = (pieces - OLD.pieces) * item_coeff 
              WHERE id = OLD.inventory_id;
           END IF;
           -- Job inventory handles quantity change normally
           IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
                INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
                VALUES (note_job_id, NEW.inventory_id, diff_pieces, diff_pieces * item_coeff)
                ON CONFLICT (job_id, item_id) 
                DO UPDATE SET pieces = job_inventory.pieces + diff_pieces, quantity = (job_inventory.pieces + diff_pieces) * item_coeff, updated_at = now();
           ELSIF note_type = 'entry' AND note_job_id IS NOT NULL THEN
                UPDATE public.job_inventory 
                SET pieces = pieces - diff_pieces, 
                    quantity = (pieces - diff_pieces) * item_coeff, 
                    updated_at = now()
                WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
           END IF;
           
      -- Case 4: Both Fictitious
      ELSE
           -- Only Job Inventory changes
           IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
                INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
                VALUES (note_job_id, NEW.inventory_id, diff_pieces, diff_pieces * item_coeff)
                ON CONFLICT (job_id, item_id) 
                DO UPDATE SET pieces = job_inventory.pieces + diff_pieces, quantity = (job_inventory.pieces + diff_pieces) * item_coeff, updated_at = now();
           ELSIF note_type = 'entry' AND note_job_id IS NOT NULL THEN
                UPDATE public.job_inventory 
                SET pieces = pieces - diff_pieces, 
                    quantity = (pieces - diff_pieces) * item_coeff, 
                    updated_at = now()
                WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
           END IF;
      END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. get_my_role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  SET search_path = public;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(v_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Fix Security Definer Views (Ensure they run with invoker privileges to respect RLS)
ALTER VIEW public.purchase_batch_availability SET (security_invoker = true);
ALTER VIEW public.job_batch_availability SET (security_invoker = true);
ALTER VIEW public.stock_movements_view SET (security_invoker = true);
