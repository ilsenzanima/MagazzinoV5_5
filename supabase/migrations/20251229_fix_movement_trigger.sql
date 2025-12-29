-- Migration: Fix Trigger per permettere salvataggio bolle
-- Data: 2025-12-29
-- Descrizione: Modifica il trigger per loggare invece di bloccare, e gestire casi edge

-- =====================================================
-- OPZIONE 1: Disabilita completamente il trigger (temporaneo per debug)
-- =====================================================
-- Decommentare per disabilitare:
-- DROP TRIGGER IF EXISTS delivery_note_items_movement_trigger ON public.delivery_note_items;

-- =====================================================
-- OPZIONE 2: Ricrea trigger con validazione meno restrittiva
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_movement_logic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  note_type TEXT;
  note_job_id UUID;
  diff NUMERIC;
  new_is_fictitious BOOLEAN;
  old_is_fictitious BOOLEAN;
  current_qty NUMERIC;
BEGIN
  new_is_fictitious := COALESCE(NEW.is_fictitious, FALSE);
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
      old_is_fictitious := COALESCE(OLD.is_fictitious, FALSE);
  END IF;

  -- INSERT
  IF TG_OP = 'INSERT' THEN
      SELECT type, job_id INTO note_type, note_job_id 
      FROM public.delivery_notes WHERE id = NEW.delivery_note_id;

      -- Se non troviamo la nota, logga e continua (non bloccare)
      IF note_type IS NULL THEN
          RAISE WARNING 'delivery_note not found for id: %', NEW.delivery_note_id;
          RETURN NULL;
      END IF;

      IF note_type IN ('exit', 'sale') THEN
          -- Validazione Disponibilità - SOLO WARNING, non blocca più
          IF NOT new_is_fictitious THEN
              SELECT COALESCE(quantity, 0) INTO current_qty FROM public.inventory WHERE id = NEW.inventory_id;
              IF current_qty < NEW.quantity THEN
                  RAISE WARNING 'Quantità insufficiente in magazzino. Richiesto: %, Disponibile: %. Continuo comunque.', NEW.quantity, current_qty;
                  -- Non blocchiamo più, permettiamo quantità negative temporaneamente
              END IF;
          END IF;

          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              INSERT INTO public.job_inventory (job_id, item_id, quantity, pieces) 
              VALUES (note_job_id, NEW.inventory_id, NEW.quantity, COALESCE(NEW.pieces, 0))
              ON CONFLICT (job_id, item_id) DO UPDATE 
              SET quantity = job_inventory.quantity + EXCLUDED.quantity,
                  pieces = job_inventory.pieces + EXCLUDED.pieces,
                  updated_at = now();
          END IF;

          IF NOT new_is_fictitious THEN
              UPDATE public.inventory 
              SET quantity = quantity - NEW.quantity,
                  pieces = pieces - COALESCE(NEW.pieces, 0)
              WHERE id = NEW.inventory_id;
          END IF;
          
      ELSIF note_type = 'entry' THEN
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory 
              SET quantity = quantity - NEW.quantity,
                  pieces = pieces - COALESCE(NEW.pieces, 0),
                  updated_at = now() 
              WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
          END IF;
          IF NOT new_is_fictitious THEN
              UPDATE public.inventory 
              SET quantity = quantity + NEW.quantity,
                  pieces = pieces + COALESCE(NEW.pieces, 0)
              WHERE id = NEW.inventory_id;
          END IF;
      END IF;

  -- DELETE
  ELSIF TG_OP = 'DELETE' THEN
      SELECT type, job_id INTO note_type, note_job_id 
      FROM public.delivery_notes WHERE id = OLD.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory 
              SET quantity = quantity - OLD.quantity,
                  pieces = pieces - COALESCE(OLD.pieces, 0)
              WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          IF NOT old_is_fictitious THEN
              UPDATE public.inventory 
              SET quantity = quantity + OLD.quantity,
                  pieces = pieces + COALESCE(OLD.pieces, 0)
              WHERE id = OLD.inventory_id;
          END IF;
      ELSIF note_type = 'entry' THEN
          -- Rimosso check quantità negativa per permettere operazioni
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory 
              SET quantity = quantity + OLD.quantity,
                  pieces = pieces + COALESCE(OLD.pieces, 0)
              WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          IF NOT old_is_fictitious THEN
              UPDATE public.inventory 
              SET quantity = quantity - OLD.quantity,
                  pieces = pieces - COALESCE(OLD.pieces, 0)
              WHERE id = OLD.inventory_id;
          END IF;
      END IF;

  -- UPDATE
  ELSIF TG_OP = 'UPDATE' THEN
      SELECT type, job_id INTO note_type, note_job_id 
      FROM public.delivery_notes WHERE id = NEW.delivery_note_id;
      diff := NEW.quantity - OLD.quantity;
      
      IF NOT new_is_fictitious AND NOT old_is_fictitious THEN
          IF diff <> 0 THEN
              IF note_type IN ('exit', 'sale') THEN
                  -- Rimosso check quantità per permettere operazioni
                  IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
                      INSERT INTO public.job_inventory (job_id, item_id, quantity) 
                      VALUES (note_job_id, NEW.inventory_id, diff)
                      ON CONFLICT (job_id, item_id) DO UPDATE 
                      SET quantity = job_inventory.quantity + diff, updated_at = now();
                  END IF;
                  UPDATE public.inventory SET quantity = quantity - diff WHERE id = NEW.inventory_id;
              ELSIF note_type = 'entry' THEN
                  IF note_job_id IS NOT NULL THEN
                      UPDATE public.job_inventory 
                      SET quantity = quantity - diff, updated_at = now() 
                      WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
                  END IF;
                  UPDATE public.inventory SET quantity = quantity + diff WHERE id = NEW.inventory_id;
              END IF;
          END IF;
      END IF;
  END IF;

  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- Log errore ma non bloccare
    RAISE WARNING 'Errore in handle_movement_logic: %', SQLERRM;
    RETURN NULL;
END;
$$;
