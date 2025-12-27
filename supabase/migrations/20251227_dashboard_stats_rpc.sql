-- Function to calculate dashboard stats on the server side (Performance Fix)
-- Calculates:
-- 1. Total Value: Based on purchase_batch_availability (FIFO/Actual Cost)
-- 2. Low Stock: Based on inventory min_stock
-- 3. Total Items: Count of inventory items

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  total_val numeric;
  low_stock bigint;
  total_items bigint;
BEGIN
  -- Calculate Total Value from Batches (accurate based on current logic)
  -- Uses purchase_batch_availability view which already handles remaining pieces
  SELECT COALESCE(SUM(remaining_pieces * coefficient * unit_price), 0)
  INTO total_val
  FROM purchase_batch_availability
  WHERE remaining_pieces > 0;

  -- Calculate Counts from Inventory
  SELECT 
    COUNT(*) FILTER (WHERE quantity <= min_stock),
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
