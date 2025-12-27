-- ==========================================
-- PERFORMANCE & SECURITY FIXES (FINAL V3)
-- ==========================================
-- Questo script risolve gli ULTIMI 3 warning rimasti in performance.json
-- 1. Risolve l'overlap tra "SELECT" (tutti) e "ALL" (admin) splittando le policy.
-- 2. Unifica le policy di UPDATE su Profiles per evitarne due separate.

-- 1. INDICI MANCANTI (Sempre utile averli)
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


-- 2. FIX POLICY "OVERLAPPING" (Risolve i 3 warning rimasti)
-- ==========================================

-- A) INVENTORY SUPPLIER CODES
-- Problema: "viewable by all" (SELECT) e "manage by Admin" (ALL) si sovrapponevano su SELECT.
-- Soluzione: Dividiamo "manage" in INSERT/UPDATE/DELETE espliciti.

DROP POLICY IF EXISTS "Supplier codes manage by Admin/Operativo" ON public.inventory_supplier_codes;
DROP POLICY IF EXISTS "Supplier codes viewable by all" ON public.inventory_supplier_codes;
-- Cleanup vecchie policy se presenti
DROP POLICY IF EXISTS "Supplier codes insert by Admin/Operativo" ON public.inventory_supplier_codes;
DROP POLICY IF EXISTS "Supplier codes update by Admin/Operativo" ON public.inventory_supplier_codes;
DROP POLICY IF EXISTS "Supplier codes delete by Admin/Operativo" ON public.inventory_supplier_codes;
DROP POLICY IF EXISTS "Supplier codes delete by Admin only" ON public.inventory_supplier_codes;

-- 1. SELECT (Tutti)
CREATE POLICY "Supplier codes viewable by all" ON public.inventory_supplier_codes FOR SELECT TO authenticated USING (true);

-- 2. INSERT (Admin/Operativo)
CREATE POLICY "Supplier codes insert by Admin/Operativo" ON public.inventory_supplier_codes FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));

-- 3. UPDATE (Admin/Operativo)
CREATE POLICY "Supplier codes update by Admin/Operativo" ON public.inventory_supplier_codes FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));

-- 4. DELETE (Admin/Operativo)
CREATE POLICY "Supplier codes delete by Admin/Operativo" ON public.inventory_supplier_codes FOR DELETE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));


-- B) JOB INVENTORY
-- Problema: Stesso problema di overlap tra SELECT (Tutti) e ALL (Admin).
-- Soluzione: Split in INSERT/UPDATE/DELETE.

DROP POLICY IF EXISTS "Job Inventory manage by Admin/Operativo" ON public.job_inventory;
DROP POLICY IF EXISTS "Job Inventory viewable by all" ON public.job_inventory;
-- Cleanup vecchie
DROP POLICY IF EXISTS "Job Inventory insert by Admin/Operativo" ON public.job_inventory;
DROP POLICY IF EXISTS "Job Inventory update by Admin/Operativo" ON public.job_inventory;
DROP POLICY IF EXISTS "Job Inventory delete by Admin/Operativo" ON public.job_inventory;
DROP POLICY IF EXISTS "Job Inventory delete by Admin only" ON public.job_inventory;

-- 1. SELECT (Tutti)
CREATE POLICY "Job Inventory viewable by all" ON public.job_inventory FOR SELECT TO authenticated USING (true);

-- 2. INSERT (Admin/Operativo)
CREATE POLICY "Job Inventory insert by Admin/Operativo" ON public.job_inventory FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));

-- 3. UPDATE (Admin/Operativo)
CREATE POLICY "Job Inventory update by Admin/Operativo" ON public.job_inventory FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));

-- 4. DELETE (Admin/Operativo)
CREATE POLICY "Job Inventory delete by Admin/Operativo" ON public.job_inventory FOR DELETE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));


-- C) PROFILES
-- Problema: Due policy separate per UPDATE ("Admins can..." e "Users can...").
-- Soluzione: Unica policy con logica OR.

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles; -- variante nome

-- Unica policy combinata
DROP POLICY IF EXISTS "Users and Admins can update profile" ON public.profiles;
CREATE POLICY "Users and Admins can update profile" ON public.profiles 
FOR UPDATE TO authenticated 
USING (
  (select auth.uid()) = id  -- Utente modifica se stesso
  OR 
  public.get_my_role() = 'admin' -- Admin modifica tutti
);


-- 3. CLEANUP GENERALE (Per sicurezza)
-- ==========================================
-- Rieseguiamo i drop delle policy duplicate già fixate, per sicurezza
DROP POLICY IF EXISTS "Clients policies" ON public.clients;
DROP POLICY IF EXISTS "Jobs policies" ON public.jobs;
DROP POLICY IF EXISTS "Authenticated users can delete purchase items." ON public.purchase_items;
DROP POLICY IF EXISTS "Authenticated users can delete purchases." ON public.purchases;
