-- =====================================================
-- FUNZIONE DI RICERCA AVANZATA INVENTARIO
-- =====================================================
-- Permette di cercare articoli includendo anche i codici fornitore secondari
-- presenti nella tabella inventory_supplier_codes
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
  v_total bigint;
BEGIN
  -- Calcolo il totale (approssimativo per performance o esatto se necessario)
  -- Per semplicità, facciamo una query separata o window function
  
  RETURN QUERY
  WITH filtered_items AS (
    SELECT 
      i.*
    FROM inventory i
    LEFT JOIN inventory_supplier_codes isc ON isc.inventory_id = i.id
    WHERE 
      (p_search IS NULL OR p_search = '' OR
       i.name ILIKE '%' || p_search || '%' OR
       i.code ILIKE '%' || p_search || '%' OR
       i.brand ILIKE '%' || p_search || '%' OR
       i.category ILIKE '%' || p_search || '%' OR
       i.supplier_code ILIKE '%' || p_search || '%' OR
       isc.code ILIKE '%' || p_search || '%')
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

-- Funzione per controllo duplicati rigoroso
CREATE OR REPLACE FUNCTION check_inventory_duplicate(
  p_name text,
  p_brand text,
  p_type text,
  p_model text
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM inventory
    WHERE 
      LOWER(name) = LOWER(p_name) AND
      LOWER(brand) = LOWER(p_brand) AND
      LOWER(category) = LOWER(p_type) AND
      LOWER(COALESCE(model, '')) = LOWER(COALESCE(p_model, ''))
  );
END;
$$ LANGUAGE plpgsql;
