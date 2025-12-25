-- FIX PERFORMANCE ADVISOR & RLS (2025-12-25)

-- 1. Fix Multiple Permissive Policies on Delivery Notes
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Delivery notes are viewable by authenticated users." ON public.delivery_notes;
DROP POLICY IF EXISTS "Authenticated users can create delivery notes." ON public.delivery_notes;
DROP POLICY IF EXISTS "Authenticated users can update delivery notes." ON public.delivery_notes;
DROP POLICY IF EXISTS "Authenticated users can delete delivery notes." ON public.delivery_notes;

DROP POLICY IF EXISTS "Delivery note items are viewable by authenticated users." ON public.delivery_note_items;
DROP POLICY IF EXISTS "Authenticated users can create delivery note items." ON public.delivery_note_items;
DROP POLICY IF EXISTS "Authenticated users can update delivery note items." ON public.delivery_note_items;
DROP POLICY IF EXISTS "Authenticated users can delete delivery note items." ON public.delivery_note_items;

-- Recreate Strict Policies (matching other tables)
-- Delivery Notes
CREATE POLICY "Delivery notes viewable by all" 
ON public.delivery_notes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Delivery notes insert by Admin/Operativo" 
ON public.delivery_notes FOR INSERT TO authenticated 
WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));

CREATE POLICY "Delivery notes update by Admin/Operativo" 
ON public.delivery_notes FOR UPDATE TO authenticated 
USING (public.get_my_role() IN ('admin', 'operativo'));

CREATE POLICY "Delivery notes delete by Admin only" 
ON public.delivery_notes FOR DELETE TO authenticated 
USING (public.get_my_role() = 'admin');

-- Delivery Note Items
CREATE POLICY "Delivery note items viewable by all" 
ON public.delivery_note_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Delivery note items insert by Admin/Operativo" 
ON public.delivery_note_items FOR INSERT TO authenticated 
WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));

CREATE POLICY "Delivery note items update by Admin/Operativo" 
ON public.delivery_note_items FOR UPDATE TO authenticated 
USING (public.get_my_role() IN ('admin', 'operativo'));

CREATE POLICY "Delivery note items delete by Admin only" 
ON public.delivery_note_items FOR DELETE TO authenticated 
USING (public.get_my_role() = 'admin');


-- 2. Add Indexes for Performance (Pagination & Search)
-- Enable pg_trgm for efficient text search if not exists
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Clients
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm ON public.clients USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_vat_trgm ON public.clients USING gin (vat_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_email_trgm ON public.clients USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_name_sort ON public.clients (name);

-- Purchases
CREATE INDEX IF NOT EXISTS idx_purchases_dn_number_trgm ON public.purchases USING gin (delivery_note_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_purchases_notes_trgm ON public.purchases USING gin (notes gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON public.purchases (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON public.purchases (created_at DESC);

-- Delivery Notes
CREATE INDEX IF NOT EXISTS idx_delivery_notes_number_trgm ON public.delivery_notes USING gin (number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_causal_trgm ON public.delivery_notes USING gin (causal gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_job_id ON public.delivery_notes (job_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_date ON public.delivery_notes (date DESC);

-- Suppliers (for pre-fetching)
CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm ON public.suppliers USING gin (name gin_trgm_ops);

-- Jobs (for pre-fetching)
CREATE INDEX IF NOT EXISTS idx_jobs_code_trgm ON public.jobs USING gin (code gin_trgm_ops);
