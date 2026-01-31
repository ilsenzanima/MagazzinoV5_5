-- Migration: Fix Function Search Path Mutable Warnings
-- Date: 2026-01-31
-- Description: Sets explicit search_path for SECURITY DEFINER functions to prevent potential security vulnerabilities.

-- 1. Fix public.get_inventory_search
DROP FUNCTION IF EXISTS public.get_inventory_search(text, text, int, int, text, text);
DROP FUNCTION IF EXISTS public.get_inventory_search(text, text, int, int); -- Cleanup old signature if exists

CREATE OR REPLACE FUNCTION public.get_inventory_search(
  p_search text,
  p_status text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_brand text DEFAULT NULL,
  p_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  code text,
  name text,
  brand text,
  category text,
  quantity numeric,
  min_stock integer,
  image_url text,
  description text,
  price numeric,
  location text,
  unit text,
  coefficient numeric,
  pieces numeric,
  supplier_code text,
  real_quantity numeric,
  model text,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- 1. Full Text Search (Existing)
    (array_length(v_words, 1) IS NULL OR (
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
$$;


-- 2. Fix public.get_dashboard_stats
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  total_val numeric;
  low_stock bigint;
  total_items bigint;
BEGIN
  -- Calculate Total Value from Batches (accurate based on current logic)
  -- Uses purchase_batch_availability view which already handles remaining pieces
  -- Note: search_path=public ensures we use public.purchase_batch_availability
  SELECT COALESCE(SUM(remaining_pieces * coefficient * unit_price), 0)
  INTO total_val
  FROM purchase_batch_availability
  WHERE remaining_pieces > 0;

  -- Calculate Counts from Inventory
  -- FIX: Added "AND quantity > 0" to exclude out of stock items from low stock count
  SELECT 
    COUNT(*) FILTER (WHERE quantity <= min_stock AND quantity > 0),
    COUNT(*)
  INTO low_stock, total_items
  FROM inventory;

  result := json_build_object(
    'totalValue', total_val,
    'lowStockCount', low_stock,
    'totalItems', total_items
  );
  
  RETURN result;
END;
$$;
