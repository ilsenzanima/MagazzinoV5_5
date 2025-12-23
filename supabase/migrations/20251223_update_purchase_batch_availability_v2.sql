DROP VIEW IF EXISTS public.purchase_batch_availability;

CREATE OR REPLACE VIEW public.purchase_batch_availability AS
SELECT 
    pi.id as purchase_item_id,
    pi.item_id,
    p.delivery_note_number as purchase_ref,
    p.created_at as purchase_date,
    
    -- Cost Info
    pi.price as unit_price,
    pi.coefficient as coefficient,

    -- Quantity
    pi.quantity as original_quantity,
    pi.quantity - COALESCE((
        SELECT SUM(
            CASE 
                WHEN dn.type = 'entry' THEN -dni.quantity 
                ELSE dni.quantity 
            END
        )
        FROM public.delivery_note_items dni
        JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
        WHERE dni.purchase_item_id = pi.id
        AND dn.type IN ('exit', 'sale', 'entry')
        AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL) -- Exclude fictitious
    ), 0) as remaining_quantity,

    -- Pieces
    pi.pieces as original_pieces,
    pi.pieces - COALESCE((
        SELECT SUM(
            CASE 
                WHEN dn.type = 'entry' THEN -dni.pieces
                ELSE dni.pieces 
            END
        )
        FROM public.delivery_note_items dni
        JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
        WHERE dni.purchase_item_id = pi.id
        AND dn.type IN ('exit', 'sale', 'entry')
        AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL) -- Exclude fictitious
    ), 0) as remaining_pieces

FROM public.purchase_items pi
JOIN public.purchases p ON pi.purchase_id = p.id;
-- Removed the WHERE > 0.001 clause to allow seeing exhausted batches for returns
-- Frontend must filter for Exit/Sale!

GRANT SELECT ON public.purchase_batch_availability TO authenticated;
