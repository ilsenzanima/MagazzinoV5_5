-- Fix inventory recalculation after cascading deletes (2026-01-02)
-- Problem: quando si elimina una delivery_note, i delivery_note_items vengono eliminati
-- PRIMA che il trigger possa leggere il tipo di nota, risultando in giacenze sbagliate.
-- Soluzione: Aggiornare la funzione di ricalcolo per essere più robusta e ricalcolare tutto.

-- 1. Migliorata funzione di ricalcolo che supporta anche pieces
CREATE OR REPLACE FUNCTION public.recalculate_inventory_item(target_item_id UUID)
RETURNS VOID AS $$
DECLARE
    total_purchased_qty NUMERIC(10,4) := 0;
    total_purchased_pcs NUMERIC(10,4) := 0;
    total_delivered_qty NUMERIC(10,4) := 0;
    total_delivered_pcs NUMERIC(10,4) := 0;
    final_quantity NUMERIC(10,4) := 0;
    final_pieces NUMERIC(10,4) := 0;
BEGIN
    -- Somma Acquisti (purchase_items) - solo quelli senza job_id (destinazione magazzino)
    -- Gli acquisti con job_id vanno direttamente in cantiere
    SELECT 
        COALESCE(SUM(pi.quantity), 0),
        COALESCE(SUM(pi.pieces), 0)
    INTO total_purchased_qty, total_purchased_pcs
    FROM public.purchase_items pi
    JOIN public.purchases p ON pi.purchase_id = p.id
    WHERE pi.item_id = target_item_id
      AND p.job_id IS NULL;

    -- Somma Movimenti (delivery_note_items)
    -- Entry = + (Ritorno a magazzino)
    -- Exit/Sale = - (Uscita da magazzino), ma solo se NON is_fictitious
    SELECT 
        COALESCE(SUM(
            CASE 
                WHEN dn.type = 'entry' THEN dni.quantity
                WHEN dn.type IN ('exit', 'sale') AND NOT COALESCE(dni.is_fictitious, FALSE) THEN -dni.quantity
                ELSE 0
            END
        ), 0),
        COALESCE(SUM(
            CASE 
                WHEN dn.type = 'entry' THEN COALESCE(dni.pieces, 0)
                WHEN dn.type IN ('exit', 'sale') AND NOT COALESCE(dni.is_fictitious, FALSE) THEN -COALESCE(dni.pieces, 0)
                ELSE 0
            END
        ), 0)
    INTO total_delivered_qty, total_delivered_pcs
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
    WHERE dni.inventory_id = target_item_id;

    -- Calcolo finale
    final_quantity := total_purchased_qty + total_delivered_qty;
    final_pieces := total_purchased_pcs + total_delivered_pcs;

    -- Aggiorna Inventario
    UPDATE public.inventory
    SET quantity = final_quantity,
        pieces = final_pieces
    WHERE id = target_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Funzione per ricalcolare TUTTO l'inventario
CREATE OR REPLACE FUNCTION public.recalculate_all_inventory()
RETURNS void AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.inventory LOOP
        PERFORM public.recalculate_inventory_item(r.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Funzione per ricalcolare job_inventory
CREATE OR REPLACE FUNCTION public.recalculate_all_job_inventory()
RETURNS void AS $$
BEGIN
    -- Svuota e ripopola job_inventory
    TRUNCATE TABLE public.job_inventory;
    
    -- Inserisci da delivery_note_items (movimenti cantiere)
    INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
    SELECT 
        dn.job_id,
        dni.inventory_id,
        SUM(
            CASE 
                WHEN dn.type = 'exit' THEN COALESCE(dni.pieces, 0)
                WHEN dn.type = 'entry' THEN -COALESCE(dni.pieces, 0)
                ELSE 0 
            END
        ) as pieces,
        SUM(
            CASE 
                WHEN dn.type = 'exit' THEN dni.quantity 
                WHEN dn.type = 'entry' THEN -dni.quantity
                ELSE 0 
            END
        ) as quantity
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
    WHERE dn.job_id IS NOT NULL AND dn.type IN ('entry', 'exit')
    GROUP BY dn.job_id, dni.inventory_id
    HAVING SUM(
        CASE 
            WHEN dn.type = 'exit' THEN dni.quantity 
            WHEN dn.type = 'entry' THEN -dni.quantity
            ELSE 0 
        END
    ) > 0;
    
    -- Aggiungi acquisti diretti per commessa
    INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
    SELECT 
        p.job_id,
        pi.item_id,
        SUM(COALESCE(pi.pieces, 0)) as pieces,
        SUM(pi.quantity) as quantity
    FROM public.purchase_items pi
    JOIN public.purchases p ON pi.purchase_id = p.id
    WHERE p.job_id IS NOT NULL
    GROUP BY p.job_id, pi.item_id
    ON CONFLICT (job_id, item_id) 
    DO UPDATE SET 
        pieces = job_inventory.pieces + EXCLUDED.pieces,
        quantity = job_inventory.quantity + EXCLUDED.quantity,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ESEGUI RICALCOLO COMPLETO ORA
SELECT public.recalculate_all_inventory();
SELECT public.recalculate_all_job_inventory();

-- 5. Opzionale: Aggiungi trigger per ricalcolo automatico dopo delete cascade
-- Questo trigger si attiva DOPO la delete della delivery_note per ricalcolare
CREATE OR REPLACE FUNCTION public.handle_delivery_note_delete()
RETURNS TRIGGER AS $$
DECLARE
    item_id UUID;
BEGIN
    -- Se la nota è stata eliminata, ricalcola tutti gli articoli che erano in quella nota
    -- Nota: questa funzione viene chiamata DOPO che gli items sono stati eliminati
    -- quindi non possiamo più accedere agli items, ma possiamo ricalcolare tutto
    
    -- Ricalcola tutti gli articoli (pesante ma sicuro)
    -- In produzione potresti voler migliorare questo usando una tabella temporanea
    PERFORM public.recalculate_all_inventory();
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Nota: Non creiamo questo trigger automatico perché ricalcolare tutto ad ogni delete
-- potrebbe essere troppo pesante. Invece, l'utente può chiamare manualmente:
-- SELECT public.recalculate_all_inventory();
-- SELECT public.recalculate_all_job_inventory();
