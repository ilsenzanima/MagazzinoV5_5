-- Fix Direct Purchase Traceability
-- Data: 2026-01-28
-- Descrizione: Inclusione acquisti diretti su commessa nella vista lotti.
-- Logica: 
-- 1. Rimuove filtro 'job_id IS NULL'
-- 2. Se job_id esiste, quantità iniziale disponibile = 0 (considerata tutta uscita verso cantiere)
-- 3. I resi (entry) incrementano la disponibiltà
-- 4. Le uscite (exit/sale) decrementano la disponibilità

CREATE OR REPLACE VIEW public.purchase_batch_availability WITH (security_invoker = true) AS
SELECT 
    pi.id as purchase_item_id,
    pi.item_id,
    p.delivery_note_number as purchase_ref,
    p.created_at as purchase_date,
    pi.price as unit_price,
    pi.coefficient as coefficient,
    pi.quantity as original_quantity,
    -- Calculate remaining quantity
    -- Logic: Initial (0 for direct job, Full for stock) - Exits + Returns
    LEAST(
        (CASE WHEN p.job_id IS NOT NULL THEN 0 ELSE pi.quantity END) 
        - COALESCE((
            SELECT SUM(dni.quantity)
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = pi.id
            AND dn.type IN ('exit', 'sale')
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
        ), 0) + COALESCE((
            SELECT SUM(dni.quantity)
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = pi.id
            AND dn.type = 'entry'
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
        ), 0),
        pi.quantity -- Cap at original capacity
    ) as remaining_quantity,
    
    pi.pieces as original_pieces,
    
    -- Calculate remaining pieces
    LEAST(
        (CASE WHEN p.job_id IS NOT NULL THEN 0 ELSE pi.pieces END)
        - COALESCE((
            SELECT SUM(dni.pieces)
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = pi.id
            AND dn.type IN ('exit', 'sale')
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
        ), 0) + COALESCE((
            SELECT SUM(dni.pieces)
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = pi.id
            AND dn.type = 'entry'
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
        ), 0),
        pi.pieces -- Cap at original capacity
    ) as remaining_pieces
    
FROM public.purchase_items pi
JOIN public.purchases p ON pi.purchase_id = p.id
-- REMOVED or MODIFIED WHERE CLAUSE to include direct purchases if they have returns
WHERE 
    -- Show lot if it has remaining pieces > 0
    LEAST(
        (CASE WHEN p.job_id IS NOT NULL THEN 0 ELSE pi.pieces END)
        - COALESCE((
            SELECT SUM(dni.pieces)
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = pi.id
            AND dn.type IN ('exit', 'sale')
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
        ), 0) + COALESCE((
            SELECT SUM(dni.pieces)
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = pi.id
            AND dn.type = 'entry'
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
        ), 0),
        pi.pieces
    ) > 0.001;

GRANT SELECT ON public.purchase_batch_availability TO authenticated;
