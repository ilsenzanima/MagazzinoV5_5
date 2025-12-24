-- Aggiornamento Permessi Ruoli (Admin, Operativo, User)

-- 1. Helper Function per controllare il ruolo
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(v_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Aggiornamento Policy INVENTORY
DROP POLICY IF EXISTS "Only admins can modify inventory." ON public.inventory;
DROP POLICY IF EXISTS "Inventory is viewable by authenticated users." ON public.inventory;

-- R (Read): Tutti
CREATE POLICY "Inventory viewable by all" ON public.inventory FOR SELECT TO authenticated USING (true);

-- U (Update): Admin e Operativo
CREATE POLICY "Inventory update by Admin/Operativo" ON public.inventory FOR UPDATE TO authenticated
USING (
  public.get_my_role() IN ('admin', 'operativo')
);

-- D (Delete): Solo Admin
CREATE POLICY "Inventory delete by Admin only" ON public.inventory FOR DELETE TO authenticated
USING (
  public.get_my_role() = 'admin'
);

-- I (Insert): Admin e Operativo
CREATE POLICY "Inventory insert by Admin/Operativo" ON public.inventory FOR INSERT TO authenticated
WITH CHECK (
  public.get_my_role() IN ('admin', 'operativo')
);


-- 3. Aggiornamento Policy JOBS, CLIENTS, SUPPLIERS, PURCHASES
-- Helper macro for standard permissions: Read=All, Write=Admin/Op, Delete=Admin

-- JOBS
DROP POLICY IF EXISTS "Jobs are viewable by authenticated users." ON public.jobs;
DROP POLICY IF EXISTS "Authenticated users can create jobs." ON public.jobs;
DROP POLICY IF EXISTS "Authenticated users can update jobs." ON public.jobs;

CREATE POLICY "Jobs viewable by all" ON public.jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Jobs insert by Admin/Operativo" ON public.jobs FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Jobs update by Admin/Operativo" ON public.jobs FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Jobs delete by Admin only" ON public.jobs FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- CLIENTS
DROP POLICY IF EXISTS "Clients are viewable by authenticated users." ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can create clients." ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can update clients." ON public.clients;

CREATE POLICY "Clients viewable by all" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Clients insert by Admin/Operativo" ON public.clients FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Clients update by Admin/Operativo" ON public.clients FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Clients delete by Admin only" ON public.clients FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- SUPPLIERS
DROP POLICY IF EXISTS "Suppliers are viewable by authenticated users." ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can create suppliers." ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can update suppliers." ON public.suppliers;

CREATE POLICY "Suppliers viewable by all" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Suppliers insert by Admin/Operativo" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Suppliers update by Admin/Operativo" ON public.suppliers FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Suppliers delete by Admin only" ON public.suppliers FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- PURCHASES
DROP POLICY IF EXISTS "Purchases are viewable by authenticated users." ON public.purchases;
DROP POLICY IF EXISTS "Authenticated users can create purchases." ON public.purchases;
DROP POLICY IF EXISTS "Authenticated users can update purchases." ON public.purchases;

CREATE POLICY "Purchases viewable by all" ON public.purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Purchases insert by Admin/Operativo" ON public.purchases FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Purchases update by Admin/Operativo" ON public.purchases FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Purchases delete by Admin only" ON public.purchases FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- PURCHASE ITEMS
DROP POLICY IF EXISTS "Purchase items are viewable by authenticated users." ON public.purchase_items;
DROP POLICY IF EXISTS "Authenticated users can create purchase items." ON public.purchase_items;
DROP POLICY IF EXISTS "Authenticated users can update purchase items." ON public.purchase_items;

CREATE POLICY "Purchase items viewable by all" ON public.purchase_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Purchase items insert by Admin/Operativo" ON public.purchase_items FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Purchase items update by Admin/Operativo" ON public.purchase_items FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Purchase items delete by Admin only" ON public.purchase_items FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- MOVEMENTS (Gia gestiti in parte, ma rinforziamo)
DROP POLICY IF EXISTS "Movements are viewable by authenticated users." ON public.movements;
DROP POLICY IF EXISTS "Authenticated users can create movements." ON public.movements;

CREATE POLICY "Movements viewable by all" ON public.movements FOR SELECT TO authenticated USING (true);
-- I movimenti sono creati da trigger o API, ma l'utente deve poter inserire se operativo/admin
-- O se è un movimento automatico (es. prelievo user)?
-- User può fare prelievi? SI, "User puo solo leggere" ma i movimenti di prelievo?
-- Se User non può creare movimenti, come scarica il materiale?
-- User = Sola lettura. Quindi User NON scarica materiale?
-- "Un utente user puo solo leggere". Quindi User NON fa movimenti.
-- OK. Se User deve scaricare, deve essere almeno Operativo o ci deve essere una policy speciale per "Scarico Personale".
-- Per ora seguo la regola: User = Read Only.
CREATE POLICY "Movements insert by Admin/Operativo" ON public.movements FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
