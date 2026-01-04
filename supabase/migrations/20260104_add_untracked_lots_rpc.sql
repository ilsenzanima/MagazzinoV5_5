-- RPC function to get items with untracked inventory (missing lots)
-- Returns items where total inventory quantity > sum of lot quantities

CREATE OR REPLACE FUNCTION public.get_items_with_untracked_lots()
RETURNS TABLE (
    item_id UUID,
    untracked_quantity NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id as item_id,
        GREATEST(0, i.quantity - COALESCE(lot_sum.total_lot_qty, 0)) as untracked_quantity
    FROM inventory i
    LEFT JOIN (
        SELECT 
            item_id,
            SUM(remaining_quantity) as total_lot_qty
        FROM purchase_batch_availability
        GROUP BY item_id
    ) lot_sum ON i.id = lot_sum.item_id
    WHERE i.quantity > COALESCE(lot_sum.total_lot_qty, 0) + 0.001; -- Only items with untracked inventory
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_items_with_untracked_lots() TO authenticated;
