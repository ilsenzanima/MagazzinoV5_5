-- Prezzo di riferimento d'acquisto (get_max_purchase_prices):
--  * exclude_from_reference: la riga d'acquisto ha un prezzo corretto per la sua commessa ma non e'
--    rappresentativo (es. ordine piccolo con trasporto incluso): non entra nel prezzo di riferimento
--    usato per le altre commesse, ne' nei confronti del Controllo Acquisti.
--  * i lotti a quantita' 0 (di norma vecchi prezzi tenuti come promemoria) sono ignorati,
--    salvo che l'articolo non abbia nessun altro acquisto: in quel caso restano come unico riferimento.
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS exclude_from_reference boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_max_purchase_prices(item_ids uuid[])
 RETURNS TABLE(item_id uuid, max_price numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    WITH real_purchases AS (
        SELECT pi.item_id,
               pi.price,
               COALESCE(pi.quantity, 0) AS qty,
               COALESCE(pu.delivery_note_date::date, pu.created_at::date) AS d,
               pu.created_at AS c
        FROM purchase_items pi
        JOIN purchases pu ON pu.id = pi.purchase_id
        WHERE pi.item_id = ANY(item_ids)
          AND pi.price IS NOT NULL
          AND pi.exclude_from_reference = false
          AND pu.order_type = 'purchase'
          AND pu.deleted_at IS NULL
    ),
    usable AS (
        SELECT rp.*
        FROM real_purchases rp
        WHERE rp.qty > 0
           OR NOT EXISTS (SELECT 1 FROM real_purchases r2 WHERE r2.item_id = rp.item_id AND r2.qty > 0)
    ),
    recent AS (
        SELECT u.item_id, MAX(u.price) AS p
        FROM usable u
        WHERE u.d >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY u.item_id
    ),
    latest AS (
        SELECT DISTINCT ON (u.item_id) u.item_id, u.price AS p
        FROM usable u
        ORDER BY u.item_id, u.d DESC, u.c DESC
    )
    SELECT l.item_id, COALESCE(r.p, l.p)
    FROM latest l
    LEFT JOIN recent r ON r.item_id = l.item_id;
$function$;
