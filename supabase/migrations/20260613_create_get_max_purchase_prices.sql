CREATE OR REPLACE FUNCTION get_max_purchase_prices(item_ids uuid[])
RETURNS TABLE(item_id uuid, max_price numeric) AS $$
    SELECT pi.item_id, MAX(pi.price)
    FROM purchase_items pi
    WHERE pi.item_id = ANY(item_ids)
    GROUP BY pi.item_id;
$$ LANGUAGE sql STABLE;
