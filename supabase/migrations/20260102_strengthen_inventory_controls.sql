-- Rafforzamento Trigger DB e Controlli Robustezza (2026-01-02)
-- Aggiunge controlli più stringenti per evitare inconsistenze nelle giacenze

-- 1. Funzione di validazione stock PRIMA di movimento uscita
CREATE OR REPLACE FUNCTION public.validate_movement_stock()
RETURNS TRIGGER AS $$
DECLARE
    note_type TEXT;
    current_stock NUMERIC;
    is_fictitious_val BOOLEAN;
BEGIN
    -- Solo per INSERT (le modifiche usano ricalcolo)
    IF TG_OP != 'INSERT' THEN
        RETURN NEW;
    END IF;
    
    -- Ottieni tipo nota
    SELECT type INTO note_type FROM public.delivery_notes WHERE id = NEW.delivery_note_id;
    
    -- Ottieni flag fittizio
    is_fictitious_val := COALESCE(NEW.is_fictitious, FALSE);
    
    -- Solo per uscite NON fittizie, verifica stock
    IF note_type IN ('exit', 'sale') AND NOT is_fictitious_val THEN
        SELECT COALESCE(quantity, 0) INTO current_stock 
        FROM public.inventory 
        WHERE id = NEW.inventory_id;
        
        IF current_stock < COALESCE(NEW.quantity, 0) THEN
            RAISE WARNING 'Attenzione: Giacenza insufficiente per articolo %. Stock attuale: %, Richiesto: %. Il movimento verrà comunque registrato.', 
                NEW.inventory_id, current_stock, NEW.quantity;
            -- Non blocchiamo ma avvisiamo (puoi cambiare in EXCEPTION per bloccare)
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger BEFORE per validazione
DROP TRIGGER IF EXISTS validate_movement_stock_trigger ON public.delivery_note_items;
CREATE TRIGGER validate_movement_stock_trigger
    BEFORE INSERT ON public.delivery_note_items
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_movement_stock();

-- 2. Protezione cancellazione articoli con giacenza negativa
-- (Aggiunge log invece di bloccare, per non impedire operazioni legittime)
CREATE OR REPLACE FUNCTION public.log_inventory_anomaly()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quantity < 0 OR NEW.pieces < 0 THEN
        -- Log dell'anomalia (visibile nei log Supabase)
        RAISE NOTICE 'ANOMALIA GIACENZA: Articolo % ha quantità negativa (qty: %, pcs: %). Verificare movimenti.', 
            NEW.id, NEW.quantity, NEW.pieces;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_inventory_anomaly_trigger ON public.inventory;
CREATE TRIGGER log_inventory_anomaly_trigger
    AFTER UPDATE ON public.inventory
    FOR EACH ROW
    WHEN (NEW.quantity < 0 OR NEW.pieces < 0)
    EXECUTE FUNCTION public.log_inventory_anomaly();

-- 3. Migliora protezione cancellazione purchase_items utilizzati
-- Se un purchase_item è referenziato in exit/sale, impedisci la cancellazione della riga
CREATE OR REPLACE FUNCTION public.check_purchase_item_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM public.delivery_note_items dni
        WHERE dni.purchase_item_id = OLD.id
    ) THEN
        RAISE EXCEPTION 'Impossibile eliminare questa riga di acquisto: è già stata utilizzata in movimenti di uscita/vendita.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_purchase_item_usage_trigger ON public.purchase_items;
CREATE TRIGGER check_purchase_item_usage_trigger
    BEFORE DELETE ON public.purchase_items
    FOR EACH ROW
    EXECUTE FUNCTION public.check_purchase_item_usage();

-- 4. Aggiungi funzione per verificare integrità inventario
CREATE OR REPLACE FUNCTION public.check_inventory_integrity()
RETURNS TABLE (
    item_id UUID,
    item_code TEXT,
    item_name TEXT,
    stored_qty NUMERIC,
    calculated_qty NUMERIC,
    difference NUMERIC,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH calculated AS (
        SELECT 
            i.id,
            i.code,
            i.name,
            i.quantity as stored,
            COALESCE((
                SELECT SUM(pi.quantity)
                FROM public.purchase_items pi
                JOIN public.purchases p ON pi.purchase_id = p.id
                WHERE pi.item_id = i.id AND p.job_id IS NULL
            ), 0) +
            COALESCE((
                SELECT SUM(
                    CASE 
                        WHEN dn.type = 'entry' THEN dni.quantity
                        WHEN dn.type IN ('exit', 'sale') AND NOT COALESCE(dni.is_fictitious, FALSE) THEN -dni.quantity
                        ELSE 0
                    END
                )
                FROM public.delivery_note_items dni
                JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
                WHERE dni.inventory_id = i.id
            ), 0) as calculated
        FROM public.inventory i
    )
    SELECT 
        c.id,
        c.code,
        c.name,
        c.stored,
        c.calculated,
        c.stored - c.calculated as diff,
        CASE 
            WHEN ABS(c.stored - c.calculated) < 0.01 THEN 'OK'
            ELSE 'DISCREPANZA'
        END as status
    FROM calculated c
    WHERE ABS(c.stored - c.calculated) >= 0.01;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Puoi chiamare questa funzione per verificare l'integrità:
-- SELECT * FROM public.check_inventory_integrity();

COMMENT ON FUNCTION public.check_inventory_integrity() IS 
'Verifica l''integrità delle giacenze confrontando il valore memorizzato con quello calcolato. 
Restituisce solo gli articoli con discrepanze. Chiamare: SELECT * FROM check_inventory_integrity();';
