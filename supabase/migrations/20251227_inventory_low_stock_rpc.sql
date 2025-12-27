-- Function to get low stock inventory items (Server-side filtering)
-- This allows pagination on low stock items without fetching the entire dataset
CREATE OR REPLACE FUNCTION get_low_stock_inventory()
RETURNS SETOF inventory
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM inventory 
  WHERE quantity <= min_stock
  ORDER BY name;
$$;
