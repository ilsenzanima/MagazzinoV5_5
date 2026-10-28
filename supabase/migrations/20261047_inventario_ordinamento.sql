-- Ricerca articoli con ordinamento per colonna (codice, nome, modello, marca, tipologia, giacenza, scorta minima).
-- Stessa logica di prima (ricerca per parole, stato, marca, tipologia, magazzino): cambia solo l'ordine dei risultati.
-- Ripristino: ricreare la versione a 7 parametri (senza p_sort e p_dir) dalla migrazione precedente della funzione
-- e fare DROP della versione a 9 parametri.

CREATE OR REPLACE FUNCTION public.get_inventory_search(
  p_search text,
  p_status text DEFAULT NULL::text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_brand text DEFAULT NULL::text,
  p_type text DEFAULT NULL::text,
  p_warehouse_id uuid DEFAULT NULL::uuid,
  p_sort text DEFAULT 'name',
  p_dir text DEFAULT 'asc'
)
RETURNS TABLE(id uuid, code text, name text, brand text, category text, quantity numeric, min_stock integer, image_url text, description text, price numeric, location text, unit text, coefficient numeric, pieces numeric, supplier_code text, real_quantity numeric, model text, created_at timestamp with time zone, updated_at timestamp with time zone, total_count bigint)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_words text[];
  v_sort text := COALESCE(NULLIF(p_sort, ''), 'name');
  v_dir text := CASE WHEN lower(COALESCE(p_dir, 'asc')) = 'desc' THEN 'desc' ELSE 'asc' END;
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
  ORDER BY
    CASE WHEN v_dir = 'asc' THEN (CASE v_sort WHEN 'code' THEN fi.code WHEN 'name' THEN fi.name WHEN 'model' THEN fi.model WHEN 'brand' THEN fi.brand WHEN 'type' THEN fi.category END) END ASC NULLS LAST,
    CASE WHEN v_dir = 'desc' THEN (CASE v_sort WHEN 'code' THEN fi.code WHEN 'name' THEN fi.name WHEN 'model' THEN fi.model WHEN 'brand' THEN fi.brand WHEN 'type' THEN fi.category END) END DESC NULLS LAST,
    CASE WHEN v_dir = 'asc' THEN (CASE v_sort WHEN 'quantity' THEN fi.quantity WHEN 'min_stock' THEN fi.min_stock::numeric END) END ASC NULLS LAST,
    CASE WHEN v_dir = 'desc' THEN (CASE v_sort WHEN 'quantity' THEN fi.quantity WHEN 'min_stock' THEN fi.min_stock::numeric END) END DESC NULLS LAST,
    fi.name ASC, fi.id
  LIMIT p_limit OFFSET p_offset;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_inventory_search(text, text, integer, integer, text, text, uuid);
