-- OPTIMIZATION MIGRATION: Fix RLS Performance Issues
-- Based on Performance Advisor recommendations (2025-12-26)

-- 1. Fix "Auth RLS Initialization Plan" warnings
-- Wrap auth.uid() in (select ...) to prevent per-row re-evaluation

-- PROFILES
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated 
WITH CHECK ( (select auth.uid()) = id );

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated 
USING ( (select auth.uid()) = id );

-- JOB LOGS
DROP POLICY IF EXISTS "Authenticated users can create logs." ON public.job_logs;
CREATE POLICY "Authenticated users can create logs." ON public.job_logs FOR INSERT TO authenticated
WITH CHECK ( (select auth.uid()) = user_id );

-- JOB DOCUMENTS
DROP POLICY IF EXISTS "Authenticated users can upload documents." ON public.job_documents;
CREATE POLICY "Authenticated users can upload documents." ON public.job_documents FOR INSERT TO authenticated
WITH CHECK ( (select auth.uid()) = uploaded_by );


-- 2. Fix "Multiple Permissive Policies" warnings
-- Consolidate or remove overlapping policies

-- CLIENTS
-- "Clients policies" is a duplicate policy that conflicts with specific ones.
DROP POLICY IF EXISTS "Clients policies" ON public.clients;

-- INVENTORY_SUPPLIER_CODES
-- "Supplier codes modifiable by authenticated" is too broad.
DROP POLICY IF EXISTS "Supplier codes modifiable by authenticated" ON public.inventory_supplier_codes;
DROP POLICY IF EXISTS "Supplier codes viewable by authenticated" ON public.inventory_supplier_codes;

-- Ensure "Supplier codes viewable by all" exists and is correct
DROP POLICY IF EXISTS "Supplier codes viewable by all" ON public.inventory_supplier_codes;
CREATE POLICY "Supplier codes viewable by all" ON public.inventory_supplier_codes FOR SELECT TO authenticated USING (true);


-- 3. Optimize get_my_role usage
-- Wrap get_my_role() in (select ...) for high-traffic tables to ensure single evaluation per query plan.

-- INVENTORY
DROP POLICY IF EXISTS "Inventory update by Admin/Operativo" ON public.inventory;
CREATE POLICY "Inventory update by Admin/Operativo" ON public.inventory FOR UPDATE TO authenticated
USING ( (select public.get_my_role()) IN ('admin', 'operativo') );

DROP POLICY IF EXISTS "Inventory delete by Admin only" ON public.inventory;
CREATE POLICY "Inventory delete by Admin only" ON public.inventory FOR DELETE TO authenticated
USING ( (select public.get_my_role()) = 'admin' );

DROP POLICY IF EXISTS "Inventory insert by Admin/Operativo" ON public.inventory;
CREATE POLICY "Inventory insert by Admin/Operativo" ON public.inventory FOR INSERT TO authenticated
WITH CHECK ( (select public.get_my_role()) IN ('admin', 'operativo') );

-- JOBS
DROP POLICY IF EXISTS "Jobs insert by Admin/Operativo" ON public.jobs;
CREATE POLICY "Jobs insert by Admin/Operativo" ON public.jobs FOR INSERT TO authenticated WITH CHECK ((select public.get_my_role()) IN ('admin', 'operativo'));

DROP POLICY IF EXISTS "Jobs update by Admin/Operativo" ON public.jobs;
CREATE POLICY "Jobs update by Admin/Operativo" ON public.jobs FOR UPDATE TO authenticated USING ((select public.get_my_role()) IN ('admin', 'operativo'));

DROP POLICY IF EXISTS "Jobs delete by Admin only" ON public.jobs;
CREATE POLICY "Jobs delete by Admin only" ON public.jobs FOR DELETE TO authenticated USING ((select public.get_my_role()) = 'admin');

-- CLIENTS
DROP POLICY IF EXISTS "Clients insert by Admin/Operativo" ON public.clients;
CREATE POLICY "Clients insert by Admin/Operativo" ON public.clients FOR INSERT TO authenticated WITH CHECK ((select public.get_my_role()) IN ('admin', 'operativo'));

DROP POLICY IF EXISTS "Clients update by Admin/Operativo" ON public.clients;
CREATE POLICY "Clients update by Admin/Operativo" ON public.clients FOR UPDATE TO authenticated USING ((select public.get_my_role()) IN ('admin', 'operativo'));

DROP POLICY IF EXISTS "Clients delete by Admin only" ON public.clients;
CREATE POLICY "Clients delete by Admin only" ON public.clients FOR DELETE TO authenticated USING ((select public.get_my_role()) = 'admin');

-- SUPPLIERS
DROP POLICY IF EXISTS "Suppliers insert by Admin/Operativo" ON public.suppliers;
CREATE POLICY "Suppliers insert by Admin/Operativo" ON public.suppliers FOR INSERT TO authenticated WITH CHECK ((select public.get_my_role()) IN ('admin', 'operativo'));

DROP POLICY IF EXISTS "Suppliers update by Admin/Operativo" ON public.suppliers;
CREATE POLICY "Suppliers update by Admin/Operativo" ON public.suppliers FOR UPDATE TO authenticated USING ((select public.get_my_role()) IN ('admin', 'operativo'));

DROP POLICY IF EXISTS "Suppliers delete by Admin only" ON public.suppliers;
CREATE POLICY "Suppliers delete by Admin only" ON public.suppliers FOR DELETE TO authenticated USING ((select public.get_my_role()) = 'admin');


-- 4. Add missing indexes for Foreign Keys (Crucial for Recalculation Performance)
-- These were likely missing and causing slow joins in recalculate_inventory_item and views
CREATE INDEX IF NOT EXISTS idx_delivery_notes_job_id ON public.delivery_notes (job_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_delivery_note_id ON public.delivery_note_items (delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_inventory_id ON public.delivery_note_items (inventory_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_purchase_item_id ON public.delivery_note_items (purchase_item_id);

-- Job Inventory (job_id is covered by primary/unique key usually, but item_id needs one for reverse lookups)
CREATE INDEX IF NOT EXISTS idx_job_inventory_item_id ON public.job_inventory (item_id);

