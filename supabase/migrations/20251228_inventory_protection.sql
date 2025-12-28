-- Protezione Inventario: Impedisce Quantità Negative
-- Creato il 2025-12-28

-- 1. Prima, ricalcola tutti gli articoli per assicurarsi che i dati siano corretti
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.inventory LOOP
        PERFORM public.recalculate_inventory_item(r.id);
    END LOOP;
    RAISE NOTICE 'Ricalcolo completato per tutti gli articoli.';
END;
$$;

-- 2. Correggi eventuali quantità ancora negative (imposta a 0)
UPDATE public.inventory 
SET quantity = 0 
WHERE quantity < 0;

-- 3. Aggiungi vincolo CHECK per impedire future quantità negative
-- (con tolleranza minima per errori floating-point)
ALTER TABLE public.inventory
DROP CONSTRAINT IF EXISTS inventory_quantity_non_negative;

ALTER TABLE public.inventory
ADD CONSTRAINT inventory_quantity_non_negative CHECK (quantity >= -0.01);

-- 4. Aggiorna il trigger per validare le uscite PRIMA di eseguirle
CREATE OR REPLACE FUNCTION public.handle_movement_logic()
RETURNS TRIGGER AS $$
DECLARE
  note_type TEXT;
  note_job_id UUID;
  diff NUMERIC;
  new_is_fictitious BOOLEAN;
  old_is_fictitious BOOLEAN;
  current_qty NUMERIC;
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
          -- *** NUOVA VALIDAZIONE: Controlla disponibilità PRIMA di scaricare ***
          IF NOT new_is_fictitious THEN
              SELECT quantity INTO current_qty FROM public.inventory WHERE id = NEW.inventory_id;
              IF current_qty < NEW.quantity THEN
                  RAISE EXCEPTION 'Quantità insufficiente in magazzino. Richiesto: %, Disponibile: %', 
                      NEW.quantity, current_qty;
              END IF;
          END IF;

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
          -- *** NUOVA VALIDAZIONE: Controlla disponibilità PRIMA di annullare un'entrata ***
          IF NOT old_is_fictitious THEN
              SELECT quantity INTO current_qty FROM public.inventory WHERE id = OLD.inventory_id;
              IF current_qty < OLD.quantity THEN
                  RAISE EXCEPTION 'Impossibile eliminare entrata: la quantità risultante sarebbe negativa. Attuale: %, Da rimuovere: %', 
                      current_qty, OLD.quantity;
              END IF;
          END IF;

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
                  -- *** NUOVA VALIDAZIONE per UPDATE di uscite ***
                  IF diff > 0 THEN
                      SELECT quantity INTO current_qty FROM public.inventory WHERE id = NEW.inventory_id;
                      IF current_qty < diff THEN
                          RAISE EXCEPTION 'Quantità insufficiente per aumentare uscita. Disponibile: %, Richiesto aggiuntivo: %', 
                              current_qty, diff;
                      END IF;
                  END IF;

                  IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
                      INSERT INTO public.job_inventory (job_id, item_id, quantity)
                      VALUES (note_job_id, NEW.inventory_id, diff)
                      ON CONFLICT (job_id, item_id) 
                      DO UPDATE SET quantity = job_inventory.quantity + diff, updated_at = now();
                  END IF;
                  UPDATE public.inventory SET quantity = quantity - diff WHERE id = NEW.inventory_id;
                  
              ELSIF note_type = 'entry' THEN
                  -- *** NUOVA VALIDAZIONE per UPDATE di entrate (riduzione) ***
                  IF diff < 0 THEN
                      SELECT quantity INTO current_qty FROM public.inventory WHERE id = NEW.inventory_id;
                      IF current_qty < ABS(diff) THEN
                          RAISE EXCEPTION 'Impossibile ridurre entrata: la quantità risultante sarebbe negativa. Attuale: %, Riduzione: %', 
                              current_qty, ABS(diff);
                      END IF;
                  END IF;

                  IF note_job_id IS NOT NULL THEN
                      UPDATE public.job_inventory SET quantity = quantity - diff, updated_at = now()
                      WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
                  END IF;
                  UPDATE public.inventory SET quantity = quantity + diff WHERE id = NEW.inventory_id;
              END IF;
          END IF;
      
      -- Case 2: Changed from Fictitious to Real
      ELSIF old_is_fictitious AND NOT new_is_fictitious THEN
           -- *** NUOVA VALIDAZIONE ***
           IF note_type IN ('exit', 'sale') THEN
              SELECT quantity INTO current_qty FROM public.inventory WHERE id = NEW.inventory_id;
              IF current_qty < NEW.quantity THEN
                  RAISE EXCEPTION 'Quantità insufficiente per rendere reale questa uscita. Disponibile: %, Richiesto: %', 
                      current_qty, NEW.quantity;
              END IF;
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
              -- *** NUOVA VALIDAZIONE ***
              SELECT quantity INTO current_qty FROM public.inventory WHERE id = OLD.inventory_id;
              IF current_qty < OLD.quantity THEN
                  RAISE EXCEPTION 'Impossibile rendere fittizia questa entrata: la quantità risultante sarebbe negativa.';
              END IF;
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

-- 5. Ricrea il trigger
DROP TRIGGER IF EXISTS on_delivery_note_item_change ON public.delivery_note_items;
CREATE TRIGGER on_delivery_note_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_note_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_movement_logic();

-- Fatto!
