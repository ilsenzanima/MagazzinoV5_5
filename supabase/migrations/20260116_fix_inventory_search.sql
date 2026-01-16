-- =====================================================
-- FIX: Ricerca inventario con parole multiple (fuzzy)
-- =====================================================
-- Permette di cercare "af panel" per trovare "AF Panel (52x500x1000)"
-- Divide la ricerca in parole e verifica che TUTTE matchino
-- Aggiunge anche ricerca nel campo model/variante
-- =====================================================

CREATE OR REPLACE FUNCTION get_inventory_search(
  p_search text,
  p_status text DEFAULT NULL, -- 'low_stock', 'out_of_stock', 'all'
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  code text,
  name text,
  brand text,
  category text,
  quantity float8,
  min_stock float8,
  image_url text,
  description text,
  price float8,
  location text,
  unit text,
  coefficient float8,
  pieces float8,
  supplier_code text,
  real_quantity float8,
  model text,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
) AS $$
DECLARE
  v_search_words text[];
  v_trimmed text;
BEGIN
  -- Trim and split search term into words
  v_trimmed := TRIM(COALESCE(p_search, ''));
  IF v_trimmed = '' THEN
    v_search_words := ARRAY[]::text[];
  ELSE
    v_search_words := string_to_array(LOWER(v_trimmed), ' ');
    -- Remove empty elements
    v_search_words := array_remove(v_search_words, '');
  END IF;

  RETURN QUERY
  WITH filtered_items AS (
    SELECT 
      i.*
    FROM inventory i
    LEFT JOIN inventory_supplier_codes isc ON isc.inventory_id = i.id
    WHERE 
      -- Multi-word fuzzy search: ALL words must match somewhere
      (v_trimmed = '' OR (
        SELECT bool_and(
          LOWER(COALESCE(i.name, '')) LIKE '%' || word || '%' OR
          LOWER(COALESCE(i.code, '')) LIKE '%' || word || '%' OR
          LOWER(COALESCE(i.brand, '')) LIKE '%' || word || '%' OR
          LOWER(COALESCE(i.category, '')) LIKE '%' || word || '%' OR
          LOWER(COALESCE(i.model, '')) LIKE '%' || word || '%' OR
          LOWER(COALESCE(i.supplier_code, '')) LIKE '%' || word || '%' OR
          LOWER(COALESCE(isc.code, '')) LIKE '%' || word || '%'
        )
        FROM unnest(v_search_words) AS word
      ))
      AND
      (p_status IS NULL OR p_status = 'all' OR
       (p_status = 'out_of_stock' AND i.quantity <= 0) OR
       (p_status = 'low_stock' AND i.quantity <= i.min_stock)
      )
    GROUP BY i.id
  )
  SELECT 
    f.*,
    (SELECT COUNT(*) FROM filtered_items) as total_count
  FROM filtered_items f
  ORDER BY f.name ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
