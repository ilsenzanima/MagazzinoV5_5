-- Add purchase_id to purchase_batch_availability view for linking to purchase detail page
DROP VIEW IF EXISTS public.purchase_batch_availability;

CREATE OR REPLACE VIEW public.purchase_batch_availability WITH (security_invoker = true) AS
SELECT 
    pi.id as purchase_item_id,
    pi.item_id,
    pi.purchase_id as purchase_id,  -- Added for linking
    p.delivery_note_number as purchase_ref,
    p.delivery_note_date as purchase_date,  -- Use delivery_note_date (DDT date) instead of created_at
    pi.price as unit_price,
    pi.coefficient as coefficient,
    pi.quantity as original_quantity,
    -- Calculate remaining quantity: original - exits + returns, capped at original
    LEAST(
        pi.quantity - COALESCE((
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
    -- Calculate remaining pieces: original - exits + returns, capped at original
    LEAST(
        pi.pieces - COALESCE((
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
WHERE p.job_id IS NULL -- Exclude direct-to-site purchases
AND (
    -- Show lot if it has remaining pieces
    LEAST(
        pi.pieces - COALESCE((
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
    ) > 0.001
);

GRANT SELECT ON public.purchase_batch_availability TO authenticated;
