-- Historical Stock Calculation RPC Function - CORRECTED
-- Uses document dates instead of created_at timestamps
-- Calculates stock at a specific date by looking at purchases and movements before that date

-- Drop existing function first
DROP FUNCTION IF EXISTS public.get_stock_at_date(DATE);

CREATE OR REPLACE FUNCTION public.get_stock_at_date(target_date DATE)
RETURNS TABLE (
    purchase_item_id UUID,
    item_id UUID,
    purchase_ref TEXT,
    purchase_date TIMESTAMP WITH TIME ZONE,
    unit_price NUMERIC,
    coefficient NUMERIC,
    original_quantity NUMERIC,
    remaining_quantity NUMERIC,
    original_pieces NUMERIC,
    remaining_pieces NUMERIC
) 
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pi.id as purchase_item_id,
        pi.item_id,
        p.delivery_note_number as purchase_ref,
        p.created_at as purchase_date,
        pi.price as unit_price,
        pi.coefficient as coefficient,
        pi.quantity as original_quantity,
        -- Calculate remaining quantity at target date
        -- Subtracts exits/sales and adds entries based on delivery note DATE (not created_at)
        LEAST(
            pi.quantity - COALESCE((
                SELECT SUM(dni.quantity)
                FROM public.delivery_note_items dni
                JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
                WHERE dni.purchase_item_id = pi.id
                AND dn.type IN ('exit', 'sale')
                AND dn.date <= target_date  -- FIXED: Use document date
                AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
            ), 0) + COALESCE((
                SELECT SUM(dni.quantity)
                FROM public.delivery_note_items dni
                JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
                WHERE dni.purchase_item_id = pi.id
                AND dn.type = 'entry'
                AND dn.date <= target_date  -- FIXED: Use document date
                AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
            ), 0),
            pi.quantity
        ) as remaining_quantity,
        pi.pieces as original_pieces,
        -- Calculate remaining pieces at target date
        LEAST(
            pi.pieces - COALESCE((
                SELECT SUM(dni.pieces)
                FROM public.delivery_note_items dni
                JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
                WHERE dni.purchase_item_id = pi.id
                AND dn.type IN ('exit', 'sale')
                AND dn.date <= target_date  -- FIXED: Use document date
                AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
            ), 0) + COALESCE((
                SELECT SUM(dni.pieces)
                FROM public.delivery_note_items dni
                JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
                WHERE dni.purchase_item_id = pi.id
                AND dn.type = 'entry'
                AND dn.date <= target_date  -- FIXED: Use document date
                AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
            ), 0),
            pi.pieces
        ) as remaining_pieces
    FROM public.purchase_items pi
    JOIN public.purchases p ON pi.purchase_id = p.id
    WHERE p.job_id IS NULL  -- Exclude direct-to-site purchases
    AND p.delivery_note_date <= target_date  -- FIXED: Use delivery_note_date instead of created_at
    AND (
        -- Show lot if it had remaining pieces at that date
        LEAST(
            pi.pieces - COALESCE((
                SELECT SUM(dni.pieces)
                FROM public.delivery_note_items dni
                JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
                WHERE dni.purchase_item_id = pi.id
                AND dn.type IN ('exit', 'sale')
                AND dn.date <= target_date  -- FIXED: Use document date
                AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
            ), 0) + COALESCE((
                SELECT SUM(dni.pieces)
                FROM public.delivery_note_items dni
                JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
                WHERE dni.purchase_item_id = pi.id
                AND dn.type = 'entry'
                AND dn.date <= target_date  -- FIXED: Use document date
                AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
            ), 0),
            pi.pieces
        ) > 0.001
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stock_at_date(DATE) TO authenticated;
