-- Espone la sede attuale anche a livello di lotto disponibile (non solo sul
-- singolo acquisto) e aggrega per articolo+magazzino, per poter filtrare
-- Inventario e Report per sede (Reana/Cervignano) oltre che vedere il totale
-- aziendale come oggi. Nessuna modifica alle colonne esistenti: solo aggiunte,
-- quindi resta compatibile con tutto ciò che già legge queste viste.

-- 1. purchase_batch_availability: aggiungi la sede attuale del lotto.
--    Stessa identica definizione corrente (vedi pg_get_viewdef), con la sola
--    aggiunta del join e delle 3 colonne.
CREATE OR REPLACE VIEW public.purchase_batch_availability WITH (security_invoker = true) AS
SELECT
    pi.id as purchase_item_id,
    pi.item_id,
    pi.purchase_id as purchase_id,
    p.delivery_note_number as purchase_ref,
    p.delivery_note_date as purchase_date,
    pi.price as unit_price,
    pi.coefficient as coefficient,
    pi.quantity as original_quantity,

    LEAST(
        (CASE WHEN p.job_id IS NOT NULL THEN 0 ELSE pi.quantity END)
        - COALESCE((
            SELECT SUM(dni.quantity)
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = pi.id
            AND dn.type IN ('exit', 'sale')
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
        ), 0) + COALESCE((
            SELECT SUM(dni.quantity)
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = pi.id
            AND dn.type = 'entry'
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
        ), 0),
        pi.quantity
    ) as remaining_quantity,

    pi.pieces as original_pieces,

    LEAST(
        (CASE WHEN p.job_id IS NOT NULL THEN 0 ELSE pi.pieces END)
        - COALESCE((
            SELECT SUM(dni.pieces)
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = pi.id
            AND dn.type IN ('exit', 'sale')
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
        ), 0) + COALESCE((
            SELECT SUM(dni.pieces)
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = pi.id
            AND dn.type = 'entry'
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
        ), 0),
        pi.pieces
    ) as remaining_pieces,

    civ.warehouse_id as current_warehouse_id,
    civ.warehouse_name as current_warehouse_name,
    civ.warehouse_is_primary as current_warehouse_is_primary

FROM public.purchase_items pi
JOIN public.purchases p ON pi.purchase_id = p.id
LEFT JOIN public.purchase_item_current_warehouse civ ON civ.purchase_item_id = pi.id
WHERE
    p.deleted_at IS NULL          -- exclude soft-deleted purchases
    AND p.order_type = 'purchase' -- exclude orders (not yet received)

    AND (
        LEAST(
            (CASE WHEN p.job_id IS NOT NULL THEN 0 ELSE pi.quantity END)
            - COALESCE((SELECT SUM(dni.quantity) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type IN ('exit', 'sale') AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0)
            + COALESCE((SELECT SUM(dni.quantity) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type = 'entry' AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0),
            pi.quantity
        ) > 0.001

        OR LEAST(
            (CASE WHEN p.job_id IS NOT NULL THEN 0 ELSE pi.pieces END)
            - COALESCE((SELECT SUM(dni.pieces) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type IN ('exit', 'sale') AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0)
            + COALESCE((SELECT SUM(dni.pieces) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type = 'entry' AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0),
            pi.pieces
        ) > 0.001

        OR p.job_id IS NOT NULL
    );

GRANT SELECT ON public.purchase_batch_availability TO authenticated;

-- 2. Aggregazione per articolo+magazzino, per Inventario e Report.
CREATE OR REPLACE VIEW public.inventory_stock_by_warehouse WITH (security_invoker = true) AS
SELECT
    item_id,
    current_warehouse_id AS warehouse_id,
    current_warehouse_name AS warehouse_name,
    current_warehouse_is_primary AS warehouse_is_primary,
    SUM(remaining_quantity) AS quantity,
    SUM(remaining_pieces) AS pieces
FROM public.purchase_batch_availability
WHERE current_warehouse_id IS NOT NULL
GROUP BY item_id, current_warehouse_id, current_warehouse_name, current_warehouse_is_primary;

GRANT SELECT ON public.inventory_stock_by_warehouse TO authenticated;

-- 3. RPC di ricerca inventario: aggiungi filtro/override opzionale per
--    magazzino (parametro con default, retrocompatibile con le chiamate
--    esistenti che non lo passano).
CREATE OR REPLACE FUNCTION public.get_inventory_search(
    p_search text,
    p_status text DEFAULT NULL::text,
    p_limit integer DEFAULT 20,
    p_offset integer DEFAULT 0,
    p_brand text DEFAULT NULL::text,
    p_type text DEFAULT NULL::text,
    p_warehouse_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(id uuid, code text, name text, brand text, category text, quantity numeric, min_stock integer, image_url text, description text, price numeric, location text, unit text, coefficient numeric, pieces numeric, supplier_code text, real_quantity numeric, model text, created_at timestamp with time zone, updated_at timestamp with time zone, total_count bigint)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_words text[];
BEGIN
  v_words := string_to_array(LOWER(TRIM(COALESCE(p_search, ''))), ' ');
  v_words := array_remove(v_words, '');

  RETURN QUERY
  WITH fi AS (
    SELECT DISTINCT
      i.id, i.code, i.name, i.brand, i.category,
      CASE WHEN p_warehouse_id IS NOT NULL THEN COALESCE(wq.quantity, 0) ELSE i.quantity END AS quantity,
      i.min_stock,
      i.image_url, i.description, i.price, i.location, i.unit, i.coefficient,
      CASE WHEN p_warehouse_id IS NOT NULL THEN COALESCE(wq.pieces, 0) ELSE i.pieces END AS pieces,
      i.supplier_code, i.real_quantity, i.model, i.created_at, i.updated_at
    FROM inventory i
    LEFT JOIN inventory_supplier_codes isc ON isc.inventory_id = i.id
    LEFT JOIN public.inventory_stock_by_warehouse wq
      ON wq.item_id = i.id AND p_warehouse_id IS NOT NULL AND wq.warehouse_id = p_warehouse_id
    WHERE
    i.deleted_at IS NULL
    AND (p_warehouse_id IS NULL OR COALESCE(wq.quantity, 0) > 0.001 OR COALESCE(wq.pieces, 0) > 0.001)
    AND (array_length(v_words, 1) IS NULL OR (
      SELECT bool_and(
        LOWER(COALESCE(i.name,'')) LIKE '%'||w||'%' OR
        LOWER(COALESCE(i.code,'')) LIKE '%'||w||'%' OR
        LOWER(COALESCE(i.brand,'')) LIKE '%'||w||'%' OR
        LOWER(COALESCE(i.category,'')) LIKE '%'||w||'%' OR
        LOWER(COALESCE(i.model,'')) LIKE '%'||w||'%' OR
        LOWER(COALESCE(i.supplier_code,'')) LIKE '%'||w||'%' OR
        LOWER(COALESCE(isc.code,'')) LIKE '%'||w||'%'
      ) FROM unnest(v_words) AS w
    ))
    AND (p_status IS NULL OR p_status = 'all' OR
         (p_status = 'out_of_stock' AND (CASE WHEN p_warehouse_id IS NOT NULL THEN COALESCE(wq.quantity, 0) ELSE i.quantity END) <= 0) OR
         (p_status = 'low_stock' AND (CASE WHEN p_warehouse_id IS NOT NULL THEN COALESCE(wq.quantity, 0) ELSE i.quantity END) <= i.min_stock AND (CASE WHEN p_warehouse_id IS NOT NULL THEN COALESCE(wq.quantity, 0) ELSE i.quantity END) > 0))
    AND (p_brand IS NULL OR i.brand = p_brand)
    AND (p_type IS NULL OR i.category = p_type)
  )
  SELECT fi.*, (SELECT COUNT(*) FROM fi)::bigint
  FROM fi
  ORDER BY fi.name
  LIMIT p_limit OFFSET p_offset;
END;
$function$;
