-- Migration: Switch to Piece-Driven Inventory (20240116)

-- 1. Add 'pieces' column to inventory and job_inventory
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS pieces NUMERIC(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.job_inventory ADD COLUMN IF NOT EXISTS pieces NUMERIC(10,2) DEFAULT 0 NOT NULL;

-- 2. Ensure Coefficients are valid (Default 1)
UPDATE public.inventory SET coefficient = 1 WHERE coefficient IS NULL OR coefficient = 0;
UPDATE public.purchase_items SET coefficient = 1 WHERE coefficient IS NULL OR coefficient = 0;
UPDATE public.delivery_note_items SET coefficient = 1 WHERE coefficient IS NULL OR coefficient = 0;

-- 3. Backfill 'pieces' in transactions if missing (assuming quantity was correct)
UPDATE public.purchase_items 
SET pieces = ROUND(quantity / coefficient, 2)
WHERE (pieces IS NULL OR pieces = 0) AND quantity > 0;

UPDATE public.delivery_note_items 
SET pieces = ROUND(quantity / coefficient, 2)
WHERE (pieces IS NULL OR pieces = 0) AND quantity > 0;

-- 4. Initial Seed of Inventory Pieces (based on current Quantity)
-- We will overwrite this with strict recalculation later, but good for safety.
UPDATE public.inventory 
SET pieces = ROUND(quantity / coefficient, 2)
WHERE pieces = 0 AND quantity <> 0;

-- 5. Function to Recalculate Inventory based on PIECES (The Source of Truth)
CREATE OR REPLACE FUNCTION public.recalculate_inventory_item(target_item_id UUID)
RETURNS VOID AS $$
DECLARE
    item_coeff NUMERIC(10,4);
    total_pieces NUMERIC(10,2) := 0;
    calc_quantity NUMERIC(10,2) := 0;
BEGIN
    -- Get Item Coefficient
    SELECT coefficient INTO item_coeff FROM public.inventory WHERE id = target_item_id;
    IF item_coeff IS NULL OR item_coeff = 0 THEN item_coeff := 1; END IF;

    -- Sum Purchase Pieces
    SELECT COALESCE(SUM(pieces), 0) INTO total_pieces
    FROM public.purchase_items
    WHERE item_id = target_item_id;

    -- Sum Delivery Note Pieces
    -- Entry = + (Return to warehouse)
    -- Exit/Sale = - (Leave warehouse)
    SELECT COALESCE(SUM(
        CASE 
            WHEN dn.type = 'entry' THEN dni.pieces
            WHEN dn.type IN ('exit', 'sale') THEN -dni.pieces
            ELSE 0
        END
    ), 0) + total_pieces INTO total_pieces
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
    WHERE dni.inventory_id = target_item_id;

    -- Sum Legacy Movements (Converted to pieces)
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

-- 6. Trigger: Purchase Item Change (Piece-Driven)
CREATE OR REPLACE FUNCTION public.handle_purchase_item_change()
RETURNS TRIGGER AS $$
DECLARE
    item_coeff NUMERIC;
BEGIN
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

-- 7. Trigger: Movement/Delivery Note Change (Piece-Driven)
CREATE OR REPLACE FUNCTION public.handle_movement_logic()
RETURNS TRIGGER AS $$
DECLARE
  note_type TEXT;
  note_job_id UUID;
  item_coeff NUMERIC;
  diff_pieces NUMERIC;
BEGIN
  -- Get Item Coefficient
  SELECT coefficient INTO item_coeff FROM public.inventory WHERE id = COALESCE(NEW.inventory_id, OLD.inventory_id);
  IF item_coeff IS NULL OR item_coeff = 0 THEN item_coeff := 1; END IF;

  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = NEW.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          -- Update Job Inventory (Add Pieces)
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
              VALUES (note_job_id, NEW.inventory_id, NEW.pieces, NEW.pieces * item_coeff)
              ON CONFLICT (job_id, item_id) 
              DO UPDATE SET 
                pieces = job_inventory.pieces + EXCLUDED.pieces,
                quantity = (job_inventory.pieces + EXCLUDED.pieces) * item_coeff,
                updated_at = now();
          END IF;
          -- Update Main Inventory (Subtract Pieces)
          UPDATE public.inventory 
          SET pieces = pieces - NEW.pieces,
              quantity = (pieces - NEW.pieces) * item_coeff
          WHERE id = NEW.inventory_id;
          
      ELSIF note_type = 'entry' THEN
          -- Update Job Inventory (Subtract Pieces)
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory 
              SET pieces = pieces - NEW.pieces,
                  quantity = (pieces - NEW.pieces) * item_coeff,
                  updated_at = now()
              WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
          END IF;
          -- Update Main Inventory (Add Pieces)
          UPDATE public.inventory 
          SET pieces = pieces + NEW.pieces,
              quantity = (pieces + NEW.pieces) * item_coeff
          WHERE id = NEW.inventory_id;
      END IF;

  -- Handle DELETE
  ELSIF TG_OP = 'DELETE' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = OLD.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory 
              SET pieces = pieces - OLD.pieces,
                  quantity = (pieces - OLD.pieces) * item_coeff
              WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          UPDATE public.inventory 
          SET pieces = pieces + OLD.pieces,
              quantity = (pieces + OLD.pieces) * item_coeff
          WHERE id = OLD.inventory_id;
          
      ELSIF note_type = 'entry' THEN
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory 
              SET pieces = pieces + OLD.pieces,
                  quantity = (pieces + OLD.pieces) * item_coeff
              WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          UPDATE public.inventory 
          SET pieces = pieces - OLD.pieces,
              quantity = (pieces - OLD.pieces) * item_coeff
          WHERE id = OLD.inventory_id;
      END IF;

  -- Handle UPDATE
  ELSIF TG_OP = 'UPDATE' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = NEW.delivery_note_id;
      diff_pieces := NEW.pieces - OLD.pieces;
      
      IF diff_pieces <> 0 THEN
          IF note_type IN ('exit', 'sale') THEN
              IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
                  INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
                  VALUES (note_job_id, NEW.inventory_id, diff_pieces, diff_pieces * item_coeff)
                  ON CONFLICT (job_id, item_id) 
                  DO UPDATE SET 
                    pieces = job_inventory.pieces + diff_pieces,
                    quantity = (job_inventory.pieces + diff_pieces) * item_coeff,
                    updated_at = now();
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
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Trigger to Auto-Calculate Quantity on Insert/Update of Transaction Items
-- This ensures that even if API sends only pieces, quantity is set correctly in the transaction table itself.
CREATE OR REPLACE FUNCTION public.calculate_quantity_from_pieces()
RETURNS TRIGGER AS $$
BEGIN
    -- If pieces is provided, calculate quantity
    IF NEW.pieces IS NOT NULL THEN
        NEW.quantity := NEW.pieces * NEW.coefficient;
    -- If quantity is provided but pieces is not, calculate pieces (Inverse)
    ELSIF NEW.quantity IS NOT NULL AND NEW.pieces IS NULL THEN
        IF NEW.coefficient <> 0 THEN
            NEW.pieces := ROUND(NEW.quantity / NEW.coefficient, 2);
            -- Recalculate quantity to match rounded pieces exactly
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

-- 9. Recalculate Everything
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.inventory LOOP
        PERFORM public.recalculate_inventory_item(r.id);
    END LOOP;
END;
$$;
