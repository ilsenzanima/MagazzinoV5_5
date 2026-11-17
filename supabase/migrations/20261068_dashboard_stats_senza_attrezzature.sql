-- Dashboard: il conteggio «da riordinare» non comprende le attrezzature (non hanno una scorta da tenere)
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
 RETURNS json
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  total_val numeric;
  low_stock bigint;
  total_items bigint;
BEGIN
  SELECT COALESCE(SUM(remaining_pieces * coefficient * unit_price), 0)
  INTO total_val
  FROM purchase_batch_availability
  WHERE remaining_pieces > 0;

  SELECT
    COUNT(*) FILTER (WHERE quantity <= min_stock AND quantity > 0 AND LOWER(COALESCE(category, '')) <> 'attrezzatura'),
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
$function$;
