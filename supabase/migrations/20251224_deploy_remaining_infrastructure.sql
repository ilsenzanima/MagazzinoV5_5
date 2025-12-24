-- DEPLOY REMAINING INFRASTRUCTURE (2025-12-24)
-- This script sets up Storage, Sequences, and RLS Policies.
-- It complements the 'Definitive Security Fix' without overwriting secure functions.

-- A. STORAGE & SEQUENCES
-- 1. Create 'images' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies (Clean & Recreate)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;

CREATE POLICY "Public Access"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'images' );

CREATE POLICY "Authenticated users can upload images"
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'images' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated users can update images"
  ON storage.objects FOR UPDATE
  USING ( bucket_id = 'images' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated users can delete images"
  ON storage.objects FOR DELETE
  USING ( bucket_id = 'images' AND auth.role() = 'authenticated' );

-- 3. Create Sequence for Article Codes (Required for get_next_article_code)
CREATE SEQUENCE IF NOT EXISTS article_code_seq START 1;

-- C. PERFORMANCE & SECURITY OPTIMIZATIONS
-- Redefine get_my_role as STABLE to prevent RLS performance issues
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(v_role, 'user');
END;
$$;

-- Redefine get_job_total_cost as STABLE
CREATE OR REPLACE FUNCTION public.get_job_total_cost(p_job_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    total_cost numeric;
BEGIN
    WITH job_movements AS (
        SELECT
            type,
            quantity,
            item_price,
            item_id,
            is_fictitious,
            date
        FROM stock_movements_view
        WHERE job_id = p_job_id
    ),
    item_prices AS (
        SELECT DISTINCT ON (item_id)
            item_id,
            item_price as last_price
        FROM job_movements
        WHERE type = 'purchase' AND item_price > 0
        ORDER BY item_id, date DESC
    ),
    calc_movements AS (
        SELECT
            m.type,
            m.quantity,
            COALESCE(
                NULLIF(m.item_price, 0),
                ip.last_price,
                0
            ) as effective_price
        FROM job_movements m
        LEFT JOIN item_prices ip ON m.item_id = ip.item_id
    )
    SELECT
        COALESCE(SUM(
            CASE 
                WHEN type = 'purchase' THEN quantity * effective_price
                ELSE -quantity * effective_price
            END
        ), 0)
    INTO total_cost
    FROM calc_movements;

    RETURN total_cost;
END;
$$;

-- B. RLS POLICIES (Tables)

-- 1. INVENTORY
DROP POLICY IF EXISTS "Only admins can modify inventory." ON public.inventory;
DROP POLICY IF EXISTS "Inventory is viewable by authenticated users." ON public.inventory;
DROP POLICY IF EXISTS "Inventory viewable by all" ON public.inventory;
DROP POLICY IF EXISTS "Inventory update by Admin/Operativo" ON public.inventory;
DROP POLICY IF EXISTS "Inventory delete by Admin only" ON public.inventory;
DROP POLICY IF EXISTS "Inventory insert by Admin/Operativo" ON public.inventory;

CREATE POLICY "Inventory viewable by all" ON public.inventory FOR SELECT TO authenticated USING (true);

CREATE POLICY "Inventory update by Admin/Operativo" ON public.inventory FOR UPDATE TO authenticated
USING ( public.get_my_role() IN ('admin', 'operativo') );

CREATE POLICY "Inventory delete by Admin only" ON public.inventory FOR DELETE TO authenticated
USING ( public.get_my_role() = 'admin' );

CREATE POLICY "Inventory insert by Admin/Operativo" ON public.inventory FOR INSERT TO authenticated
WITH CHECK ( public.get_my_role() IN ('admin', 'operativo') );

-- 2. JOBS
DROP POLICY IF EXISTS "Jobs are viewable by authenticated users." ON public.jobs;
DROP POLICY IF EXISTS "Authenticated users can create jobs." ON public.jobs;
DROP POLICY IF EXISTS "Authenticated users can update jobs." ON public.jobs;
DROP POLICY IF EXISTS "Jobs viewable by all" ON public.jobs;
DROP POLICY IF EXISTS "Jobs insert by Admin/Operativo" ON public.jobs;
DROP POLICY IF EXISTS "Jobs update by Admin/Operativo" ON public.jobs;
DROP POLICY IF EXISTS "Jobs delete by Admin only" ON public.jobs;

CREATE POLICY "Jobs viewable by all" ON public.jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Jobs insert by Admin/Operativo" ON public.jobs FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Jobs update by Admin/Operativo" ON public.jobs FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Jobs delete by Admin only" ON public.jobs FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- 3. CLIENTS
DROP POLICY IF EXISTS "Clients are viewable by authenticated users." ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can create clients." ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can update clients." ON public.clients;
DROP POLICY IF EXISTS "Clients viewable by all" ON public.clients;
DROP POLICY IF EXISTS "Clients insert by Admin/Operativo" ON public.clients;
DROP POLICY IF EXISTS "Clients update by Admin/Operativo" ON public.clients;
DROP POLICY IF EXISTS "Clients delete by Admin only" ON public.clients;

CREATE POLICY "Clients viewable by all" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Clients insert by Admin/Operativo" ON public.clients FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Clients update by Admin/Operativo" ON public.clients FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Clients delete by Admin only" ON public.clients FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- 4. SUPPLIERS
DROP POLICY IF EXISTS "Suppliers are viewable by authenticated users." ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can create suppliers." ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can update suppliers." ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers viewable by all" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers insert by Admin/Operativo" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers update by Admin/Operativo" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers delete by Admin only" ON public.suppliers;

CREATE POLICY "Suppliers viewable by all" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Suppliers insert by Admin/Operativo" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Suppliers update by Admin/Operativo" ON public.suppliers FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Suppliers delete by Admin only" ON public.suppliers FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- 5. PURCHASES
DROP POLICY IF EXISTS "Purchases are viewable by authenticated users." ON public.purchases;
DROP POLICY IF EXISTS "Authenticated users can create purchases." ON public.purchases;
DROP POLICY IF EXISTS "Authenticated users can update purchases." ON public.purchases;
DROP POLICY IF EXISTS "Purchases viewable by all" ON public.purchases;
DROP POLICY IF EXISTS "Purchases insert by Admin/Operativo" ON public.purchases;
DROP POLICY IF EXISTS "Purchases update by Admin/Operativo" ON public.purchases;
DROP POLICY IF EXISTS "Purchases delete by Admin only" ON public.purchases;

CREATE POLICY "Purchases viewable by all" ON public.purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Purchases insert by Admin/Operativo" ON public.purchases FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Purchases update by Admin/Operativo" ON public.purchases FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Purchases delete by Admin only" ON public.purchases FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- 6. PURCHASE ITEMS
DROP POLICY IF EXISTS "Purchase items are viewable by authenticated users." ON public.purchase_items;
DROP POLICY IF EXISTS "Authenticated users can create purchase items." ON public.purchase_items;
DROP POLICY IF EXISTS "Authenticated users can update purchase items." ON public.purchase_items;
DROP POLICY IF EXISTS "Purchase items viewable by all" ON public.purchase_items;
DROP POLICY IF EXISTS "Purchase items insert by Admin/Operativo" ON public.purchase_items;
DROP POLICY IF EXISTS "Purchase items update by Admin/Operativo" ON public.purchase_items;
DROP POLICY IF EXISTS "Purchase items delete by Admin only" ON public.purchase_items;

CREATE POLICY "Purchase items viewable by all" ON public.purchase_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Purchase items insert by Admin/Operativo" ON public.purchase_items FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Purchase items update by Admin/Operativo" ON public.purchase_items FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Purchase items delete by Admin only" ON public.purchase_items FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- 7. MOVEMENTS
DROP POLICY IF EXISTS "Movements are viewable by authenticated users." ON public.movements;
DROP POLICY IF EXISTS "Authenticated users can create movements." ON public.movements;
DROP POLICY IF EXISTS "Movements viewable by all" ON public.movements;
DROP POLICY IF EXISTS "Movements insert by Admin/Operativo" ON public.movements;

CREATE POLICY "Movements viewable by all" ON public.movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Movements insert by Admin/Operativo" ON public.movements FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
