-- ==========================================
-- PERFORMANCE & SECURITY FIXES
-- ==========================================
-- Questo script risolve i problemi segnalati da Supabase (performance.json)
-- 1. Aggiunge indici mancanti sulle Foreign Keys
-- 2. Rimuove policy duplicate/permissive obsolete
-- 3. Ottimizza le chiamate RLS

-- 1. INDICI MANCANTI (Unindexed Foreign Keys)
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_delivery_note_id ON public.delivery_note_items(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_inventory_id ON public.delivery_note_items(inventory_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_purchase_item_id ON public.delivery_note_items(purchase_item_id);

CREATE INDEX IF NOT EXISTS idx_delivery_notes_created_by ON public.delivery_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_job_id ON public.delivery_notes(job_id);

CREATE INDEX IF NOT EXISTS idx_inventory_supplier_codes_inventory_id ON public.inventory_supplier_codes(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_supplier_codes_supplier_id ON public.inventory_supplier_codes(supplier_id);

CREATE INDEX IF NOT EXISTS idx_job_documents_uploaded_by ON public.job_documents(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_job_inventory_item_id ON public.job_inventory(item_id);

CREATE INDEX IF NOT EXISTS idx_job_logs_user_id ON public.job_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON public.jobs(client_id);

CREATE INDEX IF NOT EXISTS idx_movements_item_id ON public.movements(item_id);
CREATE INDEX IF NOT EXISTS idx_movements_job_id ON public.movements(job_id);
CREATE INDEX IF NOT EXISTS idx_movements_user_id ON public.movements(user_id);

CREATE INDEX IF NOT EXISTS idx_purchase_items_item_id ON public.purchase_items(item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_job_id ON public.purchase_items(job_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON public.purchase_items(purchase_id);

CREATE INDEX IF NOT EXISTS idx_purchases_created_by ON public.purchases(created_by);
CREATE INDEX IF NOT EXISTS idx_purchases_job_id ON public.purchases(job_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON public.purchases(supplier_id);

CREATE INDEX IF NOT EXISTS idx_sites_job_id ON public.sites(job_id);


-- 2. CLEANUP POLICY DUPLICATE (Multiple Permissive Policies)
-- ==========================================
-- Rimuoviamo le policy "vecchie" o troppo permissive che vanno in conflitto con quelle granulari (RBAC)
-- definite in ONLINE_SETUP.sql. Questo migliora performance e sicurezza.

-- Clients
DROP POLICY IF EXISTS "Clients policies" ON public.clients;

-- Inventory Supplier Codes
-- Teniamo solo quelle specifiche se esistono, o ne creiamo una corretta.
-- Per sicurezza, rimuoviamo le vecchie e ricreiamo standard.
DROP POLICY IF EXISTS "Supplier codes modifiable by authenticated" ON public.inventory_supplier_codes;
DROP POLICY IF EXISTS "Supplier codes viewable by authenticated" ON public.inventory_supplier_codes;

CREATE POLICY "Supplier codes viewable by all" ON public.inventory_supplier_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supplier codes manage by Admin/Operativo" ON public.inventory_supplier_codes FOR ALL TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));

-- Job Inventory
DROP POLICY IF EXISTS "Job Inventory modifiable by authenticated" ON public.job_inventory;
DROP POLICY IF EXISTS "Job Inventory viewable by authenticated" ON public.job_inventory;

CREATE POLICY "Job Inventory viewable by all" ON public.job_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Job Inventory manage by Admin/Operativo" ON public.job_inventory FOR ALL TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));

-- Jobs
DROP POLICY IF EXISTS "Jobs policies" ON public.jobs;

-- Profiles
-- Rimuoviamo le policy che potrebbero essere duplicate
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;

-- Ricreiamo le policy Profiles ottimizzate (vedi punto 3)
CREATE POLICY "Profiles viewable by all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((select auth.uid()) = id);
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin');
CREATE POLICY "Admins can delete any profile" ON public.profiles FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- Purchase Items
DROP POLICY IF EXISTS "Authenticated users can delete purchase items." ON public.purchase_items;

-- Purchases
DROP POLICY IF EXISTS "Authenticated users can delete purchases." ON public.purchases;
DROP POLICY IF EXISTS "Authenticated users can update purchases job_id." ON public.purchases;


-- 3. OTTIMIZZAZIONE RLS (Auth Init Plan)
-- ==========================================
-- Ottimizziamo la funzione helper per evitare re-valutazioni costose
ALTER FUNCTION public.get_my_role() STABLE;

-- Job Logs (Fix auth.uid call)
DROP POLICY IF EXISTS "Authenticated users can create logs." ON public.job_logs;
CREATE POLICY "Authenticated users can create logs" ON public.job_logs FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

-- Job Documents (Fix auth.uid call)
DROP POLICY IF EXISTS "Authenticated users can upload documents." ON public.job_documents;
CREATE POLICY "Authenticated users can upload documents" ON public.job_documents FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = uploaded_by);
