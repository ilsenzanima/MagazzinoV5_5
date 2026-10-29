-- Statistiche per la scheda fornitore: spesa per anno e articoli acquistati con i prezzi.
-- Il «speso» è al netto dei resi; gli ordini non contano (solo order_type = 'purchase').
--
-- Per annullare:
--   DROP FUNCTION IF EXISTS public.supplier_spend_by_year(uuid);
--   DROP FUNCTION IF EXISTS public.supplier_top_items(uuid, integer);

CREATE OR REPLACE FUNCTION public.supplier_spend_by_year(p_supplier uuid)
RETURNS TABLE (year integer, purchases_count bigint, spent numeric)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    date_part('year', pu.delivery_note_date)::integer AS year,
    COUNT(DISTINCT pu.id) AS purchases_count,
    COALESCE(SUM(
      COALESCE(pi.price, 0) * COALESCE(pi.quantity, 1)
      - CASE WHEN pi.returned_at IS NOT NULL AND pi.returned_price IS NOT NULL AND pi.returned_quantity IS NOT NULL
             THEN pi.returned_quantity * pi.returned_price ELSE 0 END), 0) AS spent
  FROM purchases pu
  JOIN purchase_items pi ON pi.purchase_id = pu.id
  WHERE pu.supplier_id = p_supplier AND pu.deleted_at IS NULL AND pu.order_type = 'purchase'
    AND pu.delivery_note_date IS NOT NULL
  GROUP BY 1
  ORDER BY 1 DESC
$$;

CREATE OR REPLACE FUNCTION public.supplier_top_items(p_supplier uuid, p_limit integer DEFAULT 30)
RETURNS TABLE (
  item_id uuid, code text, name text, unit text,
  times_bought bigint, total_quantity numeric, total_spent numeric,
  last_price numeric, min_price numeric, max_price numeric, last_date date
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  WITH rows AS (
    SELECT pi.item_id, pu.id AS purchase_id, pu.delivery_note_date AS d,
           COALESCE(pi.price, 0) AS price, COALESCE(pi.quantity, 1) AS qty
    FROM purchases pu
    JOIN purchase_items pi ON pi.purchase_id = pu.id
    WHERE pu.supplier_id = p_supplier AND pu.deleted_at IS NULL AND pu.order_type = 'purchase'
  )
  SELECT
    i.id, i.code, i.name, i.unit,
    COUNT(DISTINCT r.purchase_id),
    SUM(r.qty),
    SUM(r.price * r.qty) AS total_spent,
    (array_agg(r.price ORDER BY r.d DESC NULLS LAST))[1],
    MIN(NULLIF(r.price, 0)),
    MAX(r.price),
    MAX(r.d)
  FROM rows r
  JOIN inventory i ON i.id = r.item_id
  GROUP BY i.id, i.code, i.name, i.unit
  ORDER BY total_spent DESC
  LIMIT p_limit
$$;
