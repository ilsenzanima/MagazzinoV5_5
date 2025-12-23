-- Trigger to handle stock restoration when a Delivery Note is deleted (Cascading delete issue)
-- When a Delivery Note is deleted, its items are deleted via CASCADE.
-- The standard item trigger (handle_movement_logic) runs AFTER DELETE, but by then the parent Note is gone,
-- so it cannot determine the 'type' (entry/exit) and thus fails to update stock.
-- This trigger runs BEFORE DELETE on the Note itself, ensuring stock is restored correctly.

CREATE OR REPLACE FUNCTION public.handle_delivery_note_deletion()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    is_fictitious_val BOOLEAN;
BEGIN
    -- Iterate over all items in this note
    FOR item IN SELECT * FROM public.delivery_note_items WHERE delivery_note_id = OLD.id LOOP
        
        is_fictitious_val := COALESCE(item.is_fictitious, FALSE);

        IF OLD.type IN ('exit', 'sale') THEN
            -- 1. Restore Job Inventory (if applicable)
            -- If it was an exit TO a job, deleting it means removing it FROM the job
            IF OLD.type = 'exit' AND OLD.job_id IS NOT NULL THEN
                UPDATE public.job_inventory 
                SET quantity = quantity - item.quantity,
                    updated_at = now()
                WHERE job_id = OLD.job_id AND item_id = item.inventory_id;
            END IF;
            
            -- 2. Restore Main Inventory (Increase back) - ONLY IF NOT FICTITIOUS
            -- If it was an exit FROM warehouse, deleting it means putting it BACK to warehouse
            IF NOT is_fictitious_val THEN
                UPDATE public.inventory 
                SET quantity = quantity + item.quantity 
                WHERE id = item.inventory_id;
            END IF;
            
        ELSIF OLD.type = 'entry' THEN
            -- 1. Restore Job Inventory (if applicable)
            -- If it was an entry FROM a job (return), deleting it means putting it BACK to the job
            IF OLD.job_id IS NOT NULL THEN
                UPDATE public.job_inventory 
                SET quantity = quantity + item.quantity,
                    updated_at = now()
                WHERE job_id = OLD.job_id AND item_id = item.inventory_id;
            END IF;
            
            -- 2. Restore Main Inventory (Decrease back) - ONLY IF NOT FICTITIOUS
            -- If it was an entry INTO warehouse, deleting it means removing it FROM warehouse
            IF NOT is_fictitious_val THEN
                UPDATE public.inventory 
                SET quantity = quantity - item.quantity 
                WHERE id = item.inventory_id;
            END IF;
        END IF;
    END LOOP;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger BEFORE DELETE
DROP TRIGGER IF EXISTS on_delivery_note_delete ON public.delivery_notes;
CREATE TRIGGER on_delivery_note_delete
  BEFORE DELETE ON public.delivery_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_delivery_note_deletion();

-- Also run a full recalculation to fix any desync caused by previous deletes
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.inventory LOOP
        PERFORM public.recalculate_inventory_item(r.id);
    END LOOP;
END;
$$;
