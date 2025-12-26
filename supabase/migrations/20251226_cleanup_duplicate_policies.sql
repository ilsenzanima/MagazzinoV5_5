-- Cleanup duplicate/legacy policies identified in performance.json

-- 1. inventory_supplier_codes
DROP POLICY IF EXISTS "Supplier codes manage by Admin/Operativo" ON public.inventory_supplier_codes;
DROP POLICY IF EXISTS "Supplier codes viewable by all" ON public.inventory_supplier_codes;

-- 2. job_documents
-- Drop both variants to be safe, then recreate one
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON public.job_documents;
DROP POLICY IF EXISTS "Authenticated users can upload documents." ON public.job_documents;

CREATE POLICY "Authenticated users can upload documents" ON public.job_documents 
FOR INSERT TO authenticated 
WITH CHECK (true);

-- 3. job_inventory
DROP POLICY IF EXISTS "Job Inventory manage by Admin/Operativo" ON public.job_inventory;
DROP POLICY IF EXISTS "Job Inventory viewable by all" ON public.job_inventory;

-- 4. job_logs
-- Drop both variants, recreate one
DROP POLICY IF EXISTS "Authenticated users can create logs" ON public.job_logs;
DROP POLICY IF EXISTS "Authenticated users can create logs." ON public.job_logs;

CREATE POLICY "Authenticated users can create logs" ON public.job_logs 
FOR INSERT TO authenticated 
WITH CHECK (true);

-- 5. profiles
-- Drop legacy variants (modern ones were recreated in 20251226_fix_advisor_warnings.sql)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
