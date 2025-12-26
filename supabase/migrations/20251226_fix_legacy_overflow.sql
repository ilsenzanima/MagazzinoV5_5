-- Fix legacy overflow by marking recent movements as fictitious
DO $$
DECLARE
    batch RECORD;
    movement RECORD;
    current_rem NUMERIC;
BEGIN
    -- Loop through all batches with negative remaining quantity
    FOR batch IN 
        SELECT * FROM public.purchase_batch_availability WHERE remaining_quantity < 0
    LOOP
        current_rem := batch.remaining_quantity;
        
        -- Loop through movements for this batch, starting from most recent
        FOR movement IN 
            SELECT dni.id, dni.quantity 
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = batch.purchase_item_id
            AND dn.type IN ('exit', 'sale')
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
            ORDER BY dn.date DESC, dn.created_at DESC
        LOOP
            -- If we still have negative remaining, mark this movement as fictitious
            IF current_rem < 0 THEN
                UPDATE public.delivery_note_items 
                SET is_fictitious = TRUE 
                WHERE id = movement.id;
                
                -- Adjust our running total (adding back the quantity we just "removed")
                current_rem := current_rem + movement.quantity;
                
                RAISE NOTICE 'Marked item % as fictitious for batch % (Recovered %)', movement.id, batch.purchase_item_id, movement.quantity;
            ELSE
                EXIT; -- Batch is fixed
            END IF;
        END LOOP;
    END LOOP;
END $$;
