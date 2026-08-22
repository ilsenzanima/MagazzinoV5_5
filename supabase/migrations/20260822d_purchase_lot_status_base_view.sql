-- Estrae la logica di purchase_batch_availability in una vista di base SENZA
-- il filtro "solo lotti con qualcosa di disponibile o a commessa": serve per
-- chi deve vedere TUTTI i lotti (anche esauriti/interamente resi), come lo
-- storico lotti nella scheda articolo, senza duplicare la formula altrove
-- (che in passato ha causato un disallineamento: un calcolo scritto a mano
-- in TypeScript non sapeva nulla dei resi).
CREATE OR REPLACE VIEW public.purchase_lot_status WITH (security_invoker = true) AS
SELECT
    pi.id as purchase_item_id,
    pi.item_id,
    pi.purchase_id as purchase_id,
    p.delivery_note_number as purchase_ref,
    p.delivery_note_date as purchase_date,
    pi.price as unit_price,
    pi.coefficient as coefficient,
    pi.quantity as original_quantity,
    pi.pieces as original_pieces,
    pi.returned_quantity,
    pi.returned_pieces,
    pi.returned_price,
    pi.returned_at,
    COALESCE(pi.job_id, p.job_id) as job_id,

    LEAST(
        (CASE WHEN COALESCE(pi.job_id, p.job_id) IS NOT NULL THEN 0 ELSE (pi.quantity - COALESCE(pi.returned_quantity, 0)) END)
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
        (pi.quantity - COALESCE(pi.returned_quantity, 0))
    ) as remaining_quantity,

    LEAST(
        (CASE WHEN COALESCE(pi.job_id, p.job_id) IS NOT NULL THEN 0 ELSE (pi.pieces - COALESCE(pi.returned_pieces, 0)) END)
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
        (pi.pieces - COALESCE(pi.returned_pieces, 0))
    ) as remaining_pieces,

    civ.warehouse_id as current_warehouse_id,
    civ.warehouse_name as current_warehouse_name,
    civ.warehouse_is_primary as current_warehouse_is_primary

FROM public.purchase_items pi
JOIN public.purchases p ON pi.purchase_id = p.id
LEFT JOIN public.purchase_item_current_warehouse civ ON civ.purchase_item_id = pi.id
WHERE
    p.deleted_at IS NULL
    AND p.order_type = 'purchase';

GRANT SELECT ON public.purchase_lot_status TO authenticated;

-- purchase_batch_availability diventa un semplice filtro su purchase_lot_status
-- (stessa formula, nessuna duplicazione): solo lotti con qualcosa di
-- disponibile o assegnati a commessa.
CREATE OR REPLACE VIEW public.purchase_batch_availability WITH (security_invoker = true) AS
SELECT
    purchase_item_id, item_id, purchase_id, purchase_ref, purchase_date,
    unit_price, coefficient, original_quantity, remaining_quantity,
    original_pieces, remaining_pieces,
    current_warehouse_id, current_warehouse_name, current_warehouse_is_primary
FROM public.purchase_lot_status
WHERE remaining_quantity > 0.001 OR remaining_pieces > 0.001 OR job_id IS NOT NULL;

GRANT SELECT ON public.purchase_batch_availability TO authenticated;
