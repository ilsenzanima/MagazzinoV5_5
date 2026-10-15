-- Prezzo di riferimento d'acquisto «alla data»: per ogni articolo una data (es. il primo movimento
-- dell'articolo in una commessa). Finestra di 6 mesi che termina a quella data, sulla data bolla
-- inserita a mano; gli acquisti successivi non contano. Se nella finestra non ci sono acquisti vale
-- l'ultimo acquisto precedente; se non ce ne sono, il primo acquisto successivo.
-- Ignora i lotti «non calcolare» e quelli a quantita' 0 (salvo che siano l'unico acquisto dell'articolo).
CREATE OR REPLACE FUNCTION public.get_reference_prices_asof(item_ids uuid[], as_of_dates date[])
 RETURNS TABLE(item_id uuid, as_of date, max_price numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    WITH req AS (
        SELECT i.item_id, d.as_of
        FROM unnest(item_ids) WITH ORDINALITY AS i(item_id, n)
        JOIN unnest(as_of_dates) WITH ORDINALITY AS d(as_of, n) USING (n)
    ),
    real_purchases AS (
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
    joined AS (
        SELECT r.item_id, r.as_of, u.price, u.d, u.c
        FROM req r
        JOIN usable u ON u.item_id = r.item_id
    ),
    recent AS (
        SELECT j.item_id, j.as_of, MAX(j.price) AS p
        FROM joined j
        WHERE j.d <= j.as_of AND j.d >= j.as_of - INTERVAL '6 months'
        GROUP BY j.item_id, j.as_of
    ),
    last_before AS (
        SELECT DISTINCT ON (j.item_id, j.as_of) j.item_id, j.as_of, j.price AS p
        FROM joined j
        WHERE j.d <= j.as_of
        ORDER BY j.item_id, j.as_of, j.d DESC, j.c DESC
    ),
    first_after AS (
        SELECT DISTINCT ON (j.item_id, j.as_of) j.item_id, j.as_of, j.price AS p
        FROM joined j
        WHERE j.d > j.as_of
        ORDER BY j.item_id, j.as_of, j.d ASC, j.c ASC
    )
    SELECT DISTINCT r.item_id, r.as_of, COALESCE(rc.p, lb.p, fa.p)
    FROM req r
    LEFT JOIN recent rc ON rc.item_id = r.item_id AND rc.as_of = r.as_of
    LEFT JOIN last_before lb ON lb.item_id = r.item_id AND lb.as_of = r.as_of
    LEFT JOIN first_after fa ON fa.item_id = r.item_id AND fa.as_of = r.as_of
    WHERE COALESCE(rc.p, lb.p, fa.p) IS NOT NULL;
$function$;
