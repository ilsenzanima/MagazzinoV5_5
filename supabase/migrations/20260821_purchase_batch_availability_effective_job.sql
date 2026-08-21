-- purchase_batch_availability considerava assegnato a commessa solo se il
-- job_id era impostato in testata (purchases.job_id), ignorando il caso in
-- cui la singola riga (purchase_items.job_id) abbia il proprio job_id
-- esplicito diverso dalla testata (stesso pattern "header default + override"
-- già gestito correttamente da handle_purchase_item_change()). Per le righe
-- assegnate a livello di riga, questo faceva risultare "disponibile" a
-- magazzino un lotto in realtà già spostato in giacenza di commessa,
-- causando un tentativo di sottrarre da inventory.quantity già a 0
-- (violazione del vincolo inventory_quantity_non_negative) quando quel
-- lotto veniva scelto per un'uscita/vendita reale.
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

    LEAST(
        (CASE WHEN COALESCE(pi.job_id, p.job_id) IS NOT NULL THEN 0 ELSE pi.quantity END)
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

    LEAST(
        (CASE WHEN COALESCE(pi.job_id, p.job_id) IS NOT NULL THEN 0 ELSE pi.pieces END)
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
    ) as remaining_pieces,

    civ.warehouse_id as current_warehouse_id,
    civ.warehouse_name as current_warehouse_name,
    civ.warehouse_is_primary as current_warehouse_is_primary

FROM public.purchase_items pi
JOIN public.purchases p ON pi.purchase_id = p.id
LEFT JOIN public.purchase_item_current_warehouse civ ON civ.purchase_item_id = pi.id
WHERE
    p.deleted_at IS NULL          -- exclude soft-deleted purchases
    AND p.order_type = 'purchase' -- exclude orders (not yet received)

    AND (
        LEAST(
            (CASE WHEN COALESCE(pi.job_id, p.job_id) IS NOT NULL THEN 0 ELSE pi.quantity END)
            - COALESCE((SELECT SUM(dni.quantity) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type IN ('exit', 'sale') AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0)
            + COALESCE((SELECT SUM(dni.quantity) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type = 'entry' AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0),
            pi.quantity
        ) > 0.001

        OR LEAST(
            (CASE WHEN COALESCE(pi.job_id, p.job_id) IS NOT NULL THEN 0 ELSE pi.pieces END)
            - COALESCE((SELECT SUM(dni.pieces) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type IN ('exit', 'sale') AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0)
            + COALESCE((SELECT SUM(dni.pieces) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type = 'entry' AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0),
            pi.pieces
        ) > 0.001

        OR COALESCE(pi.job_id, p.job_id) IS NOT NULL
    );

GRANT SELECT ON public.purchase_batch_availability TO authenticated;
