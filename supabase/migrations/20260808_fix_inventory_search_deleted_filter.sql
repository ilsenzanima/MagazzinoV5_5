-- Fix: get_inventory_search() non filtrava mai gli articoli con deleted_at valorizzato,
-- quindi un articolo eliminato (cestino) restava visibile nella lista principale
-- dell'inventario (che usa questa RPC per la ricerca/paginazione), pur non comparendo
-- più in inventoryApi.getAll() (usato altrove, es. nelle select), che invece filtra
-- correttamente .is('deleted_at', null).

CREATE OR REPLACE FUNCTION public.get_inventory_search(p_search text, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_brand text DEFAULT NULL::text, p_type text DEFAULT NULL::text)
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
      i.id, i.code, i.name, i.brand, i.category, i.quantity, i.min_stock,
      i.image_url, i.description, i.price, i.location, i.unit, i.coefficient, i.pieces,
      i.supplier_code, i.real_quantity, i.model, i.created_at, i.updated_at
    FROM inventory i
    LEFT JOIN inventory_supplier_codes isc ON isc.inventory_id = i.id
    WHERE
    -- 0. Escludi articoli eliminati (cestino)
    i.deleted_at IS NULL
    -- 1. Full Text Search (Existing)
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
    -- 2. Status Filter (Existing)
    AND (p_status IS NULL OR p_status = 'all' OR
         (p_status = 'out_of_stock' AND i.quantity <= 0) OR
         (p_status = 'low_stock' AND i.quantity <= i.min_stock AND i.quantity > 0))
    -- 3. Brand Filter (New)
    AND (p_brand IS NULL OR i.brand = p_brand)
    -- 4. Type/Category Filter (New)
    AND (p_type IS NULL OR i.category = p_type)
  )
  SELECT fi.*, (SELECT COUNT(*) FROM fi)::bigint
  FROM fi
  ORDER BY fi.name
  LIMIT p_limit OFFSET p_offset;
END;
$function$;
