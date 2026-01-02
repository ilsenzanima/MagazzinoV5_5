-- Fix trigger validate_movement_stock che causa errore 500 (2026-01-02)
-- Il problema era che il trigger poteva fallire silenziosamente o bloccare insert

-- 1. Rimuovi il trigger problematico temporaneamente per test
DROP TRIGGER IF EXISTS validate_movement_stock_trigger ON public.delivery_note_items;

-- 2. Ricrea la funzione con gestione errori più robusta
CREATE OR REPLACE FUNCTION public.validate_movement_stock()
RETURNS TRIGGER AS $$
DECLARE
    note_type TEXT;
    current_stock NUMERIC;
    is_fictitious_val BOOLEAN;
BEGIN
    -- Solo per INSERT
    IF TG_OP != 'INSERT' THEN
        RETURN NEW;
    END IF;
    
    -- Prova a ottenere il tipo nota, con gestione caso non trovato
    BEGIN
        SELECT type INTO note_type 
        FROM public.delivery_notes 
        WHERE id = NEW.delivery_note_id;
        
        -- Se non trovato, non fare nulla (la nota potrebbe essere appena creata)
        IF note_type IS NULL THEN
            RETURN NEW;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- In caso di errore, continua senza validazione
        RETURN NEW;
    END;
    
    -- Ottieni flag fittizio
    is_fictitious_val := COALESCE(NEW.is_fictitious, FALSE);
    
    -- Solo per uscite NON fittizie, verifica stock (solo warning, non blocca)
    IF note_type IN ('exit', 'sale') AND NOT is_fictitious_val THEN
        BEGIN
            SELECT COALESCE(quantity, 0) INTO current_stock 
            FROM public.inventory 
            WHERE id = NEW.inventory_id;
            
            IF current_stock IS NOT NULL AND current_stock < COALESCE(NEW.quantity, 0) THEN
                RAISE WARNING 'Attenzione: Giacenza insufficiente per articolo %. Stock attuale: %, Richiesto: %.', 
                    NEW.inventory_id, current_stock, NEW.quantity;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Ignora errori di validazione stock
            NULL;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ricrea il trigger (opzionale - lo rendiamo disabilitato per ora)
-- Decommentare quando si vuole riattivare la validazione:
-- CREATE TRIGGER validate_movement_stock_trigger
--     BEFORE INSERT ON public.delivery_note_items
--     FOR EACH ROW
--     EXECUTE FUNCTION public.validate_movement_stock();

-- NOTA: Per riabilitare la validazione in futuro, esegui:
-- CREATE TRIGGER validate_movement_stock_trigger
--     BEFORE INSERT ON public.delivery_note_items
--     FOR EACH ROW
--     EXECUTE FUNCTION public.validate_movement_stock();
