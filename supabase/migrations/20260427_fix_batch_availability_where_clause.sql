-- Fix purchase_batch_availability WHERE clause
-- Data: 2026-04-27
-- Problema: La WHERE usava solo i PEZZI per decidere se mostrare un lotto.
-- Se i pezzi erano NULL (acquisti senza pezzi) o completamente esauriti,
-- il lotto spariva dalla vista anche con quantità > 0, causando il fallback
-- al valore originale nel dettaglio bolla.
-- Fix: aggiunta condizione OR su remaining_quantity > 0.001

CREATE OR REPLACE VIEW public.purchase_batch_availability WITH (security_invoker = true) AS
SELECT
    pi.id as purchase_item_id,
    pi.item_id,
    pi.purchase_id as purchase_id,
    p.delivery_note_number as purchase_ref,
    p.delivery_note_date as purchase_date,
    pi.price as unit_price,
    pi.coefficient as coefficient,
    pi.quantity as original_quantity,

    -- Calculate remaining quantity
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
        pi.quantity
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
        pi.pieces
    ) as remaining_pieces

FROM public.purchase_items pi
JOIN public.purchases p ON pi.purchase_id = p.id
WHERE
    -- 1. Ha quantità residua (controllo su QUANTITY, non solo pezzi)
    LEAST(
        (CASE WHEN p.job_id IS NOT NULL THEN 0 ELSE pi.quantity END)
        - COALESCE((SELECT SUM(dni.quantity) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type IN ('exit', 'sale') AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0)
        + COALESCE((SELECT SUM(dni.quantity) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type = 'entry' AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0),
        pi.quantity
    ) > 0.001

    -- 2. O ha pezzi residui (mantenuto per compatibilità con articoli a pezzi)
    OR LEAST(
        (CASE WHEN p.job_id IS NOT NULL THEN 0 ELSE pi.pieces END)
        - COALESCE((SELECT SUM(dni.pieces) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type IN ('exit', 'sale') AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0)
        + COALESCE((SELECT SUM(dni.pieces) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type = 'entry' AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0),
        pi.pieces
    ) > 0.001

    -- 3. O è un acquisto diretto (job_id IS NOT NULL) — sempre visibile per resi
    OR p.job_id IS NOT NULL;

GRANT SELECT ON public.purchase_batch_availability TO authenticated;
