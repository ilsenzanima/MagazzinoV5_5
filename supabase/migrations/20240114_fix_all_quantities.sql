-- 1. Fix purchase_items with 0 quantity but valid pieces
-- This fixes cases where quantity wasn't calculated correctly on insert
UPDATE public.purchase_items
SET quantity = pieces * coefficient
WHERE (quantity IS NULL OR quantity = 0) AND pieces > 0;

-- 2. Function to recalculate inventory for a specific item
CREATE OR REPLACE FUNCTION public.recalculate_inventory_item(target_item_id UUID)
RETURNS VOID AS $$
DECLARE
    total_purchased NUMERIC(10,2) := 0;
    total_delivered NUMERIC(10,2) := 0;
    total_legacy NUMERIC(10,2) := 0;
    final_quantity NUMERIC(10,2) := 0;
BEGIN
    -- Sum Purchases
    SELECT COALESCE(SUM(quantity), 0) INTO total_purchased
    FROM public.purchase_items
    WHERE item_id = target_item_id;

    -- Sum Delivery Notes (Entry = +, Exit/Sale = -)
    SELECT COALESCE(SUM(
        CASE 
            WHEN dn.type = 'entry' THEN dni.quantity
            WHEN dn.type IN ('exit', 'sale') THEN -dni.quantity
            ELSE 0
        END
    ), 0) INTO total_delivered
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
    WHERE dni.inventory_id = target_item_id;

    -- Sum Legacy Movements
    SELECT COALESCE(SUM(
        CASE 
            WHEN type = 'load' THEN quantity
            WHEN type = 'unload' THEN -quantity
            ELSE 0
        END
    ), 0) INTO total_legacy
    FROM public.movements
    WHERE item_id = target_item_id;

    -- Final
    final_quantity := total_purchased + total_delivered + total_legacy;

    -- Update Inventory
    UPDATE public.inventory
    SET quantity = final_quantity
    WHERE id = target_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Execute Inventory Recalculation for all items
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.inventory LOOP
        PERFORM public.recalculate_inventory_item(r.id);
    END LOOP;
END;
$$;

-- 4. Recalculate Job Inventory (Clear and Rebuild from Delivery Notes)
TRUNCATE TABLE public.job_inventory;

INSERT INTO public.job_inventory (job_id, item_id, quantity)
SELECT 
    dn.job_id,
    dni.inventory_id,
    SUM(
        CASE 
            WHEN dn.type = 'exit' THEN dni.quantity 
            WHEN dn.type = 'entry' THEN -dni.quantity
            ELSE 0 
        END
    ) as quantity
FROM public.delivery_note_items dni
JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
WHERE dn.job_id IS NOT NULL AND dn.type IN ('entry', 'exit')
GROUP BY dn.job_id, dni.inventory_id
HAVING SUM(
    CASE 
        WHEN dn.type = 'exit' THEN dni.quantity 
        WHEN dn.type = 'entry' THEN -dni.quantity
        ELSE 0 
    END
) > 0;
