-- =====================================================
-- FIX PERFORMANCE WARNINGS - Supabase Linter
-- =====================================================

-- =====================================================
-- 1. FIX AUTH RLS INITPLAN - Use (select auth.uid()) instead of auth.uid()
-- This prevents re-evaluation for each row
-- =====================================================

-- WORKERS policies
DROP POLICY IF EXISTS "Operativo and Admin can create workers." ON public.workers;
DROP POLICY IF EXISTS "Operativo and Admin can update workers." ON public.workers;
DROP POLICY IF EXISTS "Only Admins can delete workers." ON public.workers;

CREATE POLICY "Operativo and Admin can create workers." ON public.workers
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'operativo')
    )
);

CREATE POLICY "Operativo and Admin can update workers." ON public.workers
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'operativo')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'operativo')
    )
);

CREATE POLICY "Only Admins can delete workers." ON public.workers
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role = 'admin'
    )
);

-- PROFILES policies
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users and Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;

CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Users and Admins can update profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (
    (SELECT auth.uid()) = id 
    OR EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = (SELECT auth.uid()) 
        AND p.role = 'admin'
    )
)
WITH CHECK (
    (SELECT auth.uid()) = id 
    OR EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = (SELECT auth.uid()) 
        AND p.role = 'admin'
    )
);

-- Unified admin delete policy (fixes multiple_permissive_policies warning)
CREATE POLICY "Admins can delete profiles" ON public.profiles
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = (SELECT auth.uid()) 
        AND p.role = 'admin'
    )
);

-- FICTITIOUS_ITEM_PRICES policies
DROP POLICY IF EXISTS "Admin and operativo can insert fictitious prices" ON public.fictitious_item_prices;
DROP POLICY IF EXISTS "Admin and operativo can update fictitious prices" ON public.fictitious_item_prices;
DROP POLICY IF EXISTS "Only admin can delete fictitious prices" ON public.fictitious_item_prices;

CREATE POLICY "Admin and operativo can insert fictitious prices" ON public.fictitious_item_prices
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'operativo')
    )
);

CREATE POLICY "Admin and operativo can update fictitious prices" ON public.fictitious_item_prices
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'operativo')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'operativo')
    )
);

CREATE POLICY "Only admin can delete fictitious prices" ON public.fictitious_item_prices
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role = 'admin'
    )
);

-- JOB_LOGS policies - Consolidated to fix multiple_permissive_policies warnings
DROP POLICY IF EXISTS "Users can delete own logs" ON public.job_logs;
DROP POLICY IF EXISTS "Admins can delete any log" ON public.job_logs;
DROP POLICY IF EXISTS "Users can update own logs" ON public.job_logs;
DROP POLICY IF EXISTS "Admins can update any log" ON public.job_logs;

-- Single DELETE policy (user's own OR admin/operativo)
CREATE POLICY "Users or admins can delete logs" ON public.job_logs
FOR DELETE TO authenticated
USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'operativo')
    )
);

-- Single UPDATE policy (user's own OR admin/operativo)
CREATE POLICY "Users or admins can update logs" ON public.job_logs
FOR UPDATE TO authenticated
USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'operativo')
    )
)
WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'operativo')
    )
);

-- =====================================================
-- 2. FIX DUPLICATE INDEXES - Drop redundant indexes
-- =====================================================

-- clients: drop one of idx_clients_name or idx_clients_name_sort
DROP INDEX IF EXISTS public.idx_clients_name_sort;

-- delivery_note_items: keep only idx_delivery_note_items_delivery_note_id
DROP INDEX IF EXISTS public.idx_delivery_note_items_dn_id;
DROP INDEX IF EXISTS public.idx_delivery_note_items_note_id;

-- delivery_note_items: keep only idx_delivery_note_items_inventory_id
DROP INDEX IF EXISTS public.idx_delivery_note_items_inv_id;

-- inventory: keep idx_inventory_min_stock (simpler)
DROP INDEX IF EXISTS public.idx_inventory_low_stock_composite;

-- profiles: keep idx_profiles_id_role
DROP INDEX IF EXISTS public.idx_profiles_user_role;
