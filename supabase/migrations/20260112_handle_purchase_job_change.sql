-- Migration: Handle job_id changes on purchases table
-- Data: 2026-01-12
-- Descrizione: Quando il job_id di un acquisto viene modificato,
--              le quantità degli articoli devono essere spostate
--              tra inventory e job_inventory correttamente.
--
-- Scenari:
--   1. NULL -> Job: sposta da inventory a job_inventory
--   2. Job -> NULL: sposta da job_inventory a inventory
--   3. Job A -> Job B: sposta da job_inventory A a job_inventory B

CREATE OR REPLACE FUNCTION public.handle_purchase_job_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item_record RECORD;
    v_pieces NUMERIC;
    v_qty NUMERIC;
BEGIN
    -- Solo UPDATE e solo se job_id è cambiato
    IF TG_OP = 'UPDATE' AND (OLD.job_id IS DISTINCT FROM NEW.job_id) THEN
        
        -- Per ogni articolo dell'acquisto, sposta le quantità
        FOR item_record IN 
            SELECT item_id, pieces, quantity 
            FROM public.purchase_items 
            WHERE purchase_id = NEW.id
        LOOP
            v_pieces := COALESCE(item_record.pieces, 0);
            v_qty := COALESCE(item_record.quantity, 0);
            
            -- SCENARIO 1: Da Magazzino (NULL) a Cantiere
            IF OLD.job_id IS NULL AND NEW.job_id IS NOT NULL THEN
                -- Rimuovi da inventory
                UPDATE public.inventory
                SET pieces = pieces - v_pieces,
                    quantity = quantity - v_qty
                WHERE id = item_record.item_id;
                
                -- Aggiungi a job_inventory
                INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
                VALUES (NEW.job_id, item_record.item_id, v_pieces, v_qty)
                ON CONFLICT (job_id, item_id) 
                DO UPDATE SET 
                    pieces = job_inventory.pieces + EXCLUDED.pieces,
                    quantity = job_inventory.quantity + EXCLUDED.quantity,
                    updated_at = now();
                    
            -- SCENARIO 2: Da Cantiere a Magazzino (NULL)
            ELSIF OLD.job_id IS NOT NULL AND NEW.job_id IS NULL THEN
                -- Rimuovi da job_inventory
                UPDATE public.job_inventory
                SET pieces = pieces - v_pieces,
                    quantity = quantity - v_qty,
                    updated_at = now()
                WHERE job_id = OLD.job_id AND item_id = item_record.item_id;
                
                -- Aggiungi a inventory
                UPDATE public.inventory
                SET pieces = pieces + v_pieces,
                    quantity = quantity + v_qty
                WHERE id = item_record.item_id;
                
            -- SCENARIO 3: Da Cantiere A a Cantiere B
            ELSIF OLD.job_id IS NOT NULL AND NEW.job_id IS NOT NULL THEN
                -- Rimuovi da job_inventory vecchio
                UPDATE public.job_inventory
                SET pieces = pieces - v_pieces,
                    quantity = quantity - v_qty,
                    updated_at = now()
                WHERE job_id = OLD.job_id AND item_id = item_record.item_id;
                
                -- Aggiungi a job_inventory nuovo
                INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
                VALUES (NEW.job_id, item_record.item_id, v_pieces, v_qty)
                ON CONFLICT (job_id, item_id) 
                DO UPDATE SET 
                    pieces = job_inventory.pieces + EXCLUDED.pieces,
                    quantity = job_inventory.quantity + EXCLUDED.quantity,
                    updated_at = now();
            END IF;
            
        END LOOP;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Errore in handle_purchase_job_change: %', SQLERRM;
        RETURN NEW; -- Non bloccare l'operazione
END;
$$;

-- Crea il trigger
DROP TRIGGER IF EXISTS on_purchase_job_change ON public.purchases;
CREATE TRIGGER on_purchase_job_change
    AFTER UPDATE ON public.purchases
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_purchase_job_change();

-- Commento: Questo trigger gestisce i seguenti casi d'uso:
-- 1. Creo acquisto senza job, inserisco articoli (vanno in magazzino)
--    poi associo commessa -> articoli si spostano in cantiere
-- 2. Ho un acquisto con commessa, rimuovo la commessa
--    -> articoli tornano in magazzino
-- 3. Cambio commessa da A a B -> articoli si spostano
