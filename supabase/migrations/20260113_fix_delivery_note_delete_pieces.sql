-- Fix: handle_delivery_note_deletion trigger was not updating pieces
-- This caused inventory.pieces to get out of sync when deleting delivery notes

CREATE OR REPLACE FUNCTION public.handle_delivery_note_deletion()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    is_fictitious_val BOOLEAN;
    item_pieces INT;
BEGIN
    -- Iterate over all items in this note
    FOR item IN SELECT * FROM public.delivery_note_items WHERE delivery_note_id = OLD.id LOOP
        
        is_fictitious_val := COALESCE(item.is_fictitious, FALSE);
        item_pieces := COALESCE(item.pieces, 0);

        IF OLD.type IN ('exit', 'sale') THEN
            -- 1. Restore Job Inventory (if applicable)
            IF OLD.type = 'exit' AND OLD.job_id IS NOT NULL THEN
                UPDATE public.job_inventory 
                SET quantity = quantity - item.quantity,
                    pieces = pieces - item_pieces,
                    updated_at = now()
                WHERE job_id = OLD.job_id AND item_id = item.inventory_id;
            END IF;
            
            -- 2. Restore Main Inventory (Increase back) - ONLY IF NOT FICTITIOUS
            IF NOT is_fictitious_val THEN
                UPDATE public.inventory 
                SET quantity = quantity + item.quantity,
                    pieces = pieces + item_pieces
                WHERE id = item.inventory_id;
            END IF;
            
        ELSIF OLD.type = 'entry' THEN
            -- 1. Restore Job Inventory (if applicable)
            IF OLD.job_id IS NOT NULL THEN
                UPDATE public.job_inventory 
                SET quantity = quantity + item.quantity,
                    pieces = pieces + item_pieces,
                    updated_at = now()
                WHERE job_id = OLD.job_id AND item_id = item.inventory_id;
            END IF;
            
            -- 2. Restore Main Inventory (Decrease back) - ONLY IF NOT FICTITIOUS
            IF NOT is_fictitious_val THEN
                UPDATE public.inventory 
                SET quantity = quantity - item.quantity,
                    pieces = pieces - item_pieces
                WHERE id = item.inventory_id;
            END IF;
        END IF;
    END LOOP;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- The trigger already exists, just replacing the function is enough
