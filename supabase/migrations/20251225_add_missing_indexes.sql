-- FIX UNUSED INDEXES (2025-12-25)

-- Enable pg_trgm extension for GIN indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Inventory Table Indexes (for search and filtering)
CREATE INDEX IF NOT EXISTS idx_inventory_name_trgm ON public.inventory USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_code_trgm ON public.inventory USING gin (code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_brand_trgm ON public.inventory USING gin (brand gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_category_trgm ON public.inventory USING gin (category gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_supplier_code_trgm ON public.inventory USING gin (supplier_code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON public.inventory (quantity);
CREATE INDEX IF NOT EXISTS idx_inventory_created_at ON public.inventory (created_at DESC);

-- 2. Jobs Table Additional Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_description_trgm ON public.jobs USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON public.jobs (client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs (status);

-- 3. Purchase Items Indexes (for reporting/aggregation)
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON public.purchase_items (purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_item_id ON public.purchase_items (item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_job_id ON public.purchase_items (job_id);

-- 4. Job Logs Indexes
CREATE INDEX IF NOT EXISTS idx_job_logs_job_id ON public.job_logs (job_id);
CREATE INDEX IF NOT EXISTS idx_job_logs_user_id ON public.job_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_job_logs_date ON public.job_logs (date DESC);

-- 5. Job Documents Indexes
CREATE INDEX IF NOT EXISTS idx_job_documents_job_id ON public.job_documents (job_id);

-- 6. Movements Indexes (for history)
CREATE INDEX IF NOT EXISTS idx_movements_item_id ON public.movements (item_id);
CREATE INDEX IF NOT EXISTS idx_movements_job_id ON public.movements (job_id);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON public.movements (created_at DESC);
