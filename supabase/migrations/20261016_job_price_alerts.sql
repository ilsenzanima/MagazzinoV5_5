-- Prezzi di commessa: dove non si puo' risalire a un prezzo affidabile non si inventa un valore,
-- si segnala la riga e una persona decide.
--
--  * i lotti a prezzo 0 non sono un prezzo di riferimento (get_max_purchase_prices e versione «alla data»)
--  * get_reference_price_detail: come get_reference_prices_asof ma dice anche da dove arriva il prezzo
--    (window = ultimi 6 mesi, before = ultimo acquisto precedente, after = primo acquisto successivo)
--  * get_job_price_alerts: righe delle commesse attive senza prezzo manuale per cui il prezzo manca,
--    e' di oltre 18 mesi prima della data di riferimento o esiste solo dopo di essa
--  * job_cost_analysis_rows.price_pending: «in attesa del prezzo» (es. materiale appena ordinato)
--  * preferenza notifiche job_price_missing

ALTER TABLE public.job_cost_analysis_rows
    ADD COLUMN IF NOT EXISTS price_pending boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS price_pending_note text;

ALTER TABLE public.user_notification_preferences
    ADD COLUMN IF NOT EXISTS job_price_missing boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_reference_price_detail(item_ids uuid[], as_of_dates date[])
 RETURNS TABLE(item_id uuid, as_of date, price numeric, source text, ref_date date)
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
          AND pi.price > 0
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
        SELECT DISTINCT ON (j.item_id, j.as_of) j.item_id, j.as_of, j.price AS p, j.d
        FROM joined j
        WHERE j.d <= j.as_of AND j.d >= j.as_of - INTERVAL '6 months'
        ORDER BY j.item_id, j.as_of, j.price DESC, j.d DESC
    ),
    last_before AS (
        SELECT DISTINCT ON (j.item_id, j.as_of) j.item_id, j.as_of, j.price AS p, j.d
        FROM joined j
        WHERE j.d <= j.as_of
        ORDER BY j.item_id, j.as_of, j.d DESC, j.c DESC
    ),
    first_after AS (
        SELECT DISTINCT ON (j.item_id, j.as_of) j.item_id, j.as_of, j.price AS p, j.d
        FROM joined j
        WHERE j.d > j.as_of
        ORDER BY j.item_id, j.as_of, j.d ASC, j.c ASC
    )
    SELECT DISTINCT r.item_id, r.as_of,
           COALESCE(rc.p, lb.p, fa.p),
           CASE WHEN rc.p IS NOT NULL THEN 'window' WHEN lb.p IS NOT NULL THEN 'before' ELSE 'after' END,
           COALESCE(rc.d, lb.d, fa.d)
    FROM req r
    LEFT JOIN recent rc ON rc.item_id = r.item_id AND rc.as_of = r.as_of
    LEFT JOIN last_before lb ON lb.item_id = r.item_id AND lb.as_of = r.as_of
    LEFT JOIN first_after fa ON fa.item_id = r.item_id AND fa.as_of = r.as_of
    WHERE COALESCE(rc.p, lb.p, fa.p) IS NOT NULL;
$function$;

CREATE OR REPLACE FUNCTION public.get_reference_prices_asof(item_ids uuid[], as_of_dates date[])
 RETURNS TABLE(item_id uuid, as_of date, max_price numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    SELECT d.item_id, d.as_of, d.price FROM public.get_reference_price_detail(item_ids, as_of_dates) d;
$function$;

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
          AND pi.price > 0
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

CREATE OR REPLACE FUNCTION public.get_job_price_alerts()
 RETURNS TABLE(row_id uuid, job_id uuid, job_code text, item_id uuid, item_name text, item_unit text, as_of date, reason text, ref_price numeric, ref_date date, current_price numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    WITH rows_ AS (
        SELECT r.id, r.job_id, r.item_id, r.item_name, r.item_unit, r.max_purchase_price
        FROM job_cost_analysis_rows r
        JOIN jobs j ON j.id = r.job_id
        WHERE r.type = 'inventory'
          AND r.item_id IS NOT NULL
          AND r.unit_price IS NULL
          AND r.price_pending = false
          AND j.status = 'active'
    ),
    fm AS (
        SELECT sm.job_id, sm.item_id, MIN(sm.date)::date AS d
        FROM stock_movements_view sm
        WHERE sm.job_id IN (SELECT rr.job_id FROM rows_ rr)
        GROUP BY sm.job_id, sm.item_id
    ),
    req AS (
        SELECT r.*, COALESCE(fm.d, CURRENT_DATE) AS d
        FROM rows_ r
        LEFT JOIN fm ON fm.job_id = r.job_id AND fm.item_id = r.item_id
    ),
    pairs AS (SELECT DISTINCT q.item_id, q.d FROM req q),
    det AS (
        SELECT * FROM get_reference_price_detail(
            (SELECT array_agg(p.item_id) FROM pairs p),
            (SELECT array_agg(p.d) FROM pairs p))
    ),
    res AS (
        SELECT q.id, q.job_id, q.item_id, q.item_name, q.item_unit, q.d, q.max_purchase_price,
               det.price, det.ref_date,
               CASE
                   WHEN det.price IS NULL THEN 'missing'
                   WHEN det.source = 'after' THEN 'after'
                   WHEN det.source = 'before' AND det.ref_date < q.d - INTERVAL '18 months' THEN 'old'
                   ELSE NULL
               END AS reason
        FROM req q
        LEFT JOIN det ON det.item_id = q.item_id AND det.as_of = q.d
    )
    SELECT x.id, x.job_id, j.code, x.item_id, x.item_name, x.item_unit, x.d, x.reason, x.price, x.ref_date, x.max_purchase_price
    FROM res x
    JOIN jobs j ON j.id = x.job_id
    WHERE x.reason IS NOT NULL
    ORDER BY j.code, x.item_name;
$function$;
