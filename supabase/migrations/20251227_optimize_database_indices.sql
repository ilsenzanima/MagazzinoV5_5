occ-- Optimize Database Performance based on AI Report
-- 1. Enable pg_stat_statements for query monitoring (if permissions allow)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 2. Optimize Inventory Low Stock Queries
-- The RPC uses "quantity <= min_stock", so we need to index min_stock and ideally the combination.
CREATE INDEX IF NOT EXISTS idx_inventory_min_stock ON public.inventory (min_stock);
-- Composite index might be more effective for the specific comparison
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock_composite ON public.inventory (quantity, min_stock);

-- 3. Optimize Delivery Note Items (High Sequential Scans reported)
-- Ensure Foreign Keys are indexed for faster joins
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_dn_id ON public.delivery_note_items (delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_inv_id ON public.delivery_note_items (inventory_id);

-- 4. Optimize Jobs (High Sequential Scans reported)
-- 'status' is already indexed in 20251225, adding 'code' if missing as it's often searched
CREATE INDEX IF NOT EXISTS idx_jobs_code_trgm ON public.jobs USING gin (code gin_trgm_ops);

-- 5. Maintenance
ANALYZE public.inventory;
ANALYZE public.delivery_note_items;
ANALYZE public.jobs;
