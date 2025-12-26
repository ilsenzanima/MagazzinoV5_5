-- 1. Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- 2. Grant usage on extensions schema to standard Supabase roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- 3. Drop dependent indexes that use pg_trgm operator classes
-- From 20251225_add_missing_indexes.sql
DROP INDEX IF EXISTS public.idx_inventory_name_trgm;
DROP INDEX IF EXISTS public.idx_inventory_code_trgm;
DROP INDEX IF EXISTS public.idx_inventory_brand_trgm;
DROP INDEX IF EXISTS public.idx_inventory_category_trgm;
DROP INDEX IF EXISTS public.idx_inventory_supplier_code_trgm;
DROP INDEX IF EXISTS public.idx_jobs_description_trgm;

-- From 20251225_performance_and_rls_fixes.sql
DROP INDEX IF EXISTS public.idx_clients_name_trgm;
DROP INDEX IF EXISTS public.idx_clients_vat_trgm;
DROP INDEX IF EXISTS public.idx_clients_email_trgm;
DROP INDEX IF EXISTS public.idx_purchases_dn_number_trgm;
DROP INDEX IF EXISTS public.idx_purchases_notes_trgm;
DROP INDEX IF EXISTS public.idx_delivery_notes_number_trgm;
DROP INDEX IF EXISTS public.idx_delivery_notes_causal_trgm;
DROP INDEX IF EXISTS public.idx_suppliers_name_trgm;
DROP INDEX IF EXISTS public.idx_jobs_code_trgm;

-- 4. Drop the extension from public schema
-- This would drop dependent objects if we hadn't dropped them manually,
-- but dropping indexes first is cleaner/safer to ensure we know what we are removing.
DROP EXTENSION IF EXISTS pg_trgm;

-- 5. Re-create the extension in the dedicated schema
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- 6. Re-create the indexes using the schema-qualified operator class

-- Inventory
CREATE INDEX IF NOT EXISTS idx_inventory_name_trgm ON public.inventory USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_code_trgm ON public.inventory USING gin (code extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_brand_trgm ON public.inventory USING gin (brand extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_category_trgm ON public.inventory USING gin (category extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_supplier_code_trgm ON public.inventory USING gin (supplier_code extensions.gin_trgm_ops);

-- Jobs
CREATE INDEX IF NOT EXISTS idx_jobs_description_trgm ON public.jobs USING gin (description extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_code_trgm ON public.jobs USING gin (code extensions.gin_trgm_ops);

-- Clients
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm ON public.clients USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_vat_trgm ON public.clients USING gin (vat_number extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_email_trgm ON public.clients USING gin (email extensions.gin_trgm_ops);

-- Purchases
CREATE INDEX IF NOT EXISTS idx_purchases_dn_number_trgm ON public.purchases USING gin (delivery_note_number extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_purchases_notes_trgm ON public.purchases USING gin (notes extensions.gin_trgm_ops);

-- Delivery Notes
CREATE INDEX IF NOT EXISTS idx_delivery_notes_number_trgm ON public.delivery_notes USING gin (number extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_causal_trgm ON public.delivery_notes USING gin (causal extensions.gin_trgm_ops);

-- Suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm ON public.suppliers USING gin (name extensions.gin_trgm_ops);
