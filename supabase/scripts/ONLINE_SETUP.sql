
-- ==========================================
-- SCRIPT DI ALLINEAMENTO ONLINE (MASTER FIX)
-- ==========================================
-- Esegui questo script nell'SQL Editor di Supabase per allineare il database online
-- con tutte le funzionalità, trigger e sicurezza sviluppati.

-- 1. FIX RUOLI UTENTI
-- ==========================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'user', 'operativo'));


-- 2. FUNZIONI E TRIGGER BASE (ACQUISTI)
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_purchase_item_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.inventory
    SET quantity = quantity + NEW.quantity
    WHERE id = NEW.item_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.inventory
    SET quantity = quantity - OLD.quantity
    WHERE id = OLD.item_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.quantity <> NEW.quantity THEN
        UPDATE public.inventory
        SET quantity = quantity - OLD.quantity + NEW.quantity
        WHERE id = NEW.item_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_purchase_item_change ON public.purchase_items;
CREATE TRIGGER on_purchase_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_purchase_item_change();


-- 3. LOGICA MOVIMENTI E RICALCOLO (CON SUPPORTO FITTIZI)
-- ==========================================
CREATE OR REPLACE FUNCTION public.recalculate_inventory_item(target_item_id UUID)
RETURNS VOID AS $$
DECLARE
    total_purchased NUMERIC(10,2) := 0;
    total_delivered NUMERIC(10,2) := 0;
    total_legacy NUMERIC(10,2) := 0;
    final_quantity NUMERIC(10,2) := 0;
BEGIN
    -- Sum Purchases
    SELECT COALESCE(SUM(quantity), 0) INTO total_purchased
    FROM public.purchase_items
    WHERE item_id = target_item_id;

    -- Sum Delivery Notes (Exclude Fictitious)
    SELECT COALESCE(SUM(
        CASE 
            WHEN dn.type = 'entry' THEN dni.quantity
            WHEN dn.type IN ('exit', 'sale') THEN -dni.quantity
            ELSE 0
        END
    ), 0) INTO total_delivered
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
    WHERE dni.inventory_id = target_item_id
    AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL);

    -- Sum Legacy Movements
    SELECT COALESCE(SUM(
        CASE 
            WHEN type = 'load' THEN quantity
            WHEN type = 'unload' THEN -quantity
            ELSE 0
        END
    ), 0) INTO total_legacy
    FROM public.movements
    WHERE item_id = target_item_id;

    -- Final
    final_quantity := total_purchased + total_delivered + total_legacy;

    -- Update Inventory
    UPDATE public.inventory
    SET quantity = final_quantity
    WHERE id = target_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_movement_logic()
RETURNS TRIGGER AS $$
DECLARE
  note_type TEXT;
  note_job_id UUID;
  diff NUMERIC;
  new_is_fictitious BOOLEAN;
  old_is_fictitious BOOLEAN;
BEGIN
  new_is_fictitious := COALESCE(NEW.is_fictitious, FALSE);
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
      old_is_fictitious := COALESCE(OLD.is_fictitious, FALSE);
  END IF;

  IF TG_OP = 'INSERT' THEN
      SELECT type, job_id INTO note_type, note_job_id
      FROM public.delivery_notes
      WHERE id = NEW.delivery_note_id;

      IF note_type IN ('exit', 'sale') THEN
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              INSERT INTO public.job_inventory (job_id, item_id, quantity)
              VALUES (note_job_id, NEW.inventory_id, NEW.quantity)
              ON CONFLICT (job_id, item_id) 
              DO UPDATE SET 
                  quantity = job_inventory.quantity + EXCLUDED.quantity,
                  updated_at = now();
          END IF;

          IF NOT new_is_fictitious THEN
              UPDATE public.inventory
              SET quantity = quantity - NEW.quantity
              WHERE id = NEW.inventory_id;
          END IF;
          
      ELSIF note_type = 'entry' THEN
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory
              SET quantity = quantity - NEW.quantity,
                  updated_at = now()
              WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
          END IF;

          IF NOT new_is_fictitious THEN
              UPDATE public.inventory
              SET quantity = quantity + NEW.quantity
              WHERE id = NEW.inventory_id;
          END IF;
      END IF;

  ELSIF TG_OP = 'DELETE' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = OLD.delivery_note_id;
      
      IF note_type IN ('exit', 'sale') THEN
          IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET quantity = quantity - OLD.quantity WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          
          IF NOT old_is_fictitious THEN
              UPDATE public.inventory SET quantity = quantity + OLD.quantity WHERE id = OLD.inventory_id;
          END IF;
          
      ELSIF note_type = 'entry' THEN
          IF note_job_id IS NOT NULL THEN
              UPDATE public.job_inventory SET quantity = quantity + OLD.quantity WHERE job_id = note_job_id AND item_id = OLD.inventory_id;
          END IF;
          
          IF NOT old_is_fictitious THEN
              UPDATE public.inventory SET quantity = quantity - OLD.quantity WHERE id = OLD.inventory_id;
          END IF;
      END IF;

  ELSIF TG_OP = 'UPDATE' THEN
      SELECT type, job_id INTO note_type, note_job_id FROM public.delivery_notes WHERE id = NEW.delivery_note_id;
      diff := NEW.quantity - OLD.quantity;
      
      IF NOT new_is_fictitious AND NOT old_is_fictitious THEN
          IF diff <> 0 THEN
              IF note_type IN ('exit', 'sale') THEN
                  IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
                      INSERT INTO public.job_inventory (job_id, item_id, quantity)
                      VALUES (note_job_id, NEW.inventory_id, diff)
                      ON CONFLICT (job_id, item_id) 
                      DO UPDATE SET quantity = job_inventory.quantity + diff, updated_at = now();
                  END IF;
                  UPDATE public.inventory SET quantity = quantity - diff WHERE id = NEW.inventory_id;
                  
              ELSIF note_type = 'entry' THEN
                  IF note_job_id IS NOT NULL THEN
                      UPDATE public.job_inventory SET quantity = quantity - diff, updated_at = now()
                      WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
                  END IF;
                  UPDATE public.inventory SET quantity = quantity + diff WHERE id = NEW.inventory_id;
              END IF;
          END IF;
      
      ELSIF old_is_fictitious AND NOT new_is_fictitious THEN
           IF note_type IN ('exit', 'sale') THEN
              UPDATE public.inventory SET quantity = quantity - NEW.quantity WHERE id = NEW.inventory_id;
           ELSIF note_type = 'entry' THEN
              UPDATE public.inventory SET quantity = quantity + NEW.quantity WHERE id = NEW.inventory_id;
           END IF;
           IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
                INSERT INTO public.job_inventory (job_id, item_id, quantity)
                VALUES (note_job_id, NEW.inventory_id, diff)
                ON CONFLICT (job_id, item_id) 
                DO UPDATE SET quantity = job_inventory.quantity + diff, updated_at = now();
           ELSIF note_type = 'entry' AND note_job_id IS NOT NULL THEN
                UPDATE public.job_inventory SET quantity = quantity - diff, updated_at = now()
                WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
           END IF;

      ELSIF NOT old_is_fictitious AND new_is_fictitious THEN
           IF note_type IN ('exit', 'sale') THEN
              UPDATE public.inventory SET quantity = quantity + OLD.quantity WHERE id = OLD.inventory_id;
           ELSIF note_type = 'entry' THEN
              UPDATE public.inventory SET quantity = quantity - OLD.quantity WHERE id = OLD.inventory_id;
           END IF;
           IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
                INSERT INTO public.job_inventory (job_id, item_id, quantity)
                VALUES (note_job_id, NEW.inventory_id, diff)
                ON CONFLICT (job_id, item_id) 
                DO UPDATE SET quantity = job_inventory.quantity + diff, updated_at = now();
           ELSIF note_type = 'entry' AND note_job_id IS NOT NULL THEN
                UPDATE public.job_inventory SET quantity = quantity - diff, updated_at = now()
                WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
           END IF;
           
      ELSE
           IF note_type = 'exit' AND note_job_id IS NOT NULL THEN
                INSERT INTO public.job_inventory (job_id, item_id, quantity)
                VALUES (note_job_id, NEW.inventory_id, diff)
                ON CONFLICT (job_id, item_id) 
                DO UPDATE SET quantity = job_inventory.quantity + diff, updated_at = now();
           ELSIF note_type = 'entry' AND note_job_id IS NOT NULL THEN
                UPDATE public.job_inventory SET quantity = quantity - diff, updated_at = now()
                WHERE job_id = note_job_id AND item_id = NEW.inventory_id;
           END IF;
      END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_delivery_note_item_change ON public.delivery_note_items;
CREATE TRIGGER on_delivery_note_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_note_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_movement_logic();


-- 4. VISTE (VIEWS)
-- ==========================================
DROP VIEW IF EXISTS public.stock_movements_view;
CREATE OR REPLACE VIEW public.stock_movements_view WITH (security_invoker = true) AS
SELECT
    pi.id,
    pi.created_at as date,
    'purchase' as type,
    pi.quantity as quantity,
    p.delivery_note_number as reference,
    pi.item_id,
    p.created_by as user_id,
    pr.full_name as user_name,
    i.code as item_code,
    i.name as item_name,
    i.unit as item_unit,
    pi.price as item_price,
    pi.pieces,
    pi.coefficient,
    p.notes,
    COALESCE(pi.job_id, p.job_id) as job_id,
    FALSE as is_fictitious,
    s.name as supplier_name,
    p.delivery_note_date as purchase_date,
    p.delivery_note_number as purchase_number,
    p.id as purchase_id,
    NULL::uuid as delivery_note_id
FROM public.purchase_items pi
JOIN public.purchases p ON pi.purchase_id = p.id
LEFT JOIN public.profiles pr ON p.created_by = pr.id
LEFT JOIN public.inventory i ON pi.item_id = i.id
LEFT JOIN public.suppliers s ON p.supplier_id = s.id
UNION ALL
SELECT
    dni.id,
    dni.created_at as date,
    dn.type,
    CASE 
        WHEN dn.type = 'entry' THEN dni.quantity
        ELSE -dni.quantity
    END as quantity,
    dn.number as reference,
    dni.inventory_id as item_id,
    dn.created_by as user_id,
    pr.full_name as user_name,
    i.code as item_code,
    i.name as item_name,
    i.unit as item_unit,
    COALESCE(pi.price, i.price) as item_price,
    dni.pieces,
    dni.coefficient,
    dn.notes,
    dn.job_id,
    dni.is_fictitious,
    s.name as supplier_name,
    p.delivery_note_date as purchase_date,
    p.delivery_note_number as purchase_number,
    p.id as purchase_id,
    dn.id as delivery_note_id
FROM public.delivery_note_items dni
JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
LEFT JOIN public.profiles pr ON dn.created_by = pr.id
LEFT JOIN public.inventory i ON dni.inventory_id = i.id
LEFT JOIN public.purchase_items pi ON dni.purchase_item_id = pi.id
LEFT JOIN public.purchases p ON pi.purchase_id = p.id
LEFT JOIN public.suppliers s ON p.supplier_id = s.id
UNION ALL
SELECT
    m.id,
    m.created_at as date,
    CASE
        WHEN m.type = 'load' THEN 'entry'
        WHEN m.type = 'unload' THEN 'exit'
        ELSE m.type
    END as type,
    CASE 
        WHEN m.type = 'load' THEN m.quantity
        ELSE -m.quantity
    END as quantity,
    m.reference,
    m.item_id,
    m.user_id,
    pr.full_name as user_name,
    i.code as item_code,
    i.name as item_name,
    i.unit as item_unit,
    i.price as item_price,
    NULL as pieces,
    NULL as coefficient,
    m.notes,
    m.job_id,
    FALSE as is_fictitious,
    NULL as supplier_name,
    NULL as purchase_date,
    NULL as purchase_number,
    NULL as purchase_id,
    NULL as delivery_note_id
FROM public.movements m
LEFT JOIN public.profiles pr ON m.user_id = pr.id
LEFT JOIN public.inventory i ON m.item_id = i.id;

DROP VIEW IF EXISTS public.purchase_batch_availability;
CREATE OR REPLACE VIEW public.purchase_batch_availability AS
SELECT 
    pi.id as purchase_item_id,
    pi.item_id,
    p.delivery_note_number as purchase_ref,
    p.created_at as purchase_date,
    pi.price as unit_price,
    pi.coefficient as coefficient,
    pi.quantity as original_quantity,
    pi.quantity - COALESCE((
        SELECT SUM(dni.quantity)
        FROM public.delivery_note_items dni
        JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
        WHERE dni.purchase_item_id = pi.id
        AND dn.type IN ('exit', 'sale')
        AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
    ), 0) as remaining_quantity,
    pi.pieces as original_pieces,
    pi.pieces - COALESCE((
        SELECT SUM(dni.pieces)
        FROM public.delivery_note_items dni
        JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
        WHERE dni.purchase_item_id = pi.id
        AND dn.type IN ('exit', 'sale')
        AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
    ), 0) as remaining_pieces
FROM public.purchase_items pi
JOIN public.purchases p ON pi.purchase_id = p.id
WHERE (
    pi.pieces - COALESCE((
        SELECT SUM(dni.pieces)
        FROM public.delivery_note_items dni
        JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
        WHERE dni.purchase_item_id = pi.id
        AND dn.type IN ('exit', 'sale')
        AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
    ), 0)
) > 0.001;

GRANT SELECT ON public.purchase_batch_availability TO authenticated;


-- 5. SICUREZZA E POLICY (RBAC)
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(v_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- INVENTORY
DROP POLICY IF EXISTS "Inventory viewable by all" ON public.inventory;
DROP POLICY IF EXISTS "Inventory update by Admin/Operativo" ON public.inventory;
DROP POLICY IF EXISTS "Inventory delete by Admin only" ON public.inventory;
DROP POLICY IF EXISTS "Inventory insert by Admin/Operativo" ON public.inventory;

CREATE POLICY "Inventory viewable by all" ON public.inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Inventory update by Admin/Operativo" ON public.inventory FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Inventory delete by Admin only" ON public.inventory FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');
CREATE POLICY "Inventory insert by Admin/Operativo" ON public.inventory FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));

-- JOBS
DROP POLICY IF EXISTS "Jobs viewable by all" ON public.jobs;
DROP POLICY IF EXISTS "Jobs insert by Admin/Operativo" ON public.jobs;
DROP POLICY IF EXISTS "Jobs update by Admin/Operativo" ON public.jobs;
DROP POLICY IF EXISTS "Jobs delete by Admin only" ON public.jobs;

CREATE POLICY "Jobs viewable by all" ON public.jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Jobs insert by Admin/Operativo" ON public.jobs FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Jobs update by Admin/Operativo" ON public.jobs FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Jobs delete by Admin only" ON public.jobs FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- CLIENTS
DROP POLICY IF EXISTS "Clients viewable by all" ON public.clients;
DROP POLICY IF EXISTS "Clients insert by Admin/Operativo" ON public.clients;
DROP POLICY IF EXISTS "Clients update by Admin/Operativo" ON public.clients;
DROP POLICY IF EXISTS "Clients delete by Admin only" ON public.clients;

CREATE POLICY "Clients viewable by all" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Clients insert by Admin/Operativo" ON public.clients FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Clients update by Admin/Operativo" ON public.clients FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Clients delete by Admin only" ON public.clients FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- SUPPLIERS
DROP POLICY IF EXISTS "Suppliers viewable by all" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers insert by Admin/Operativo" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers update by Admin/Operativo" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers delete by Admin only" ON public.suppliers;

CREATE POLICY "Suppliers viewable by all" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Suppliers insert by Admin/Operativo" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Suppliers update by Admin/Operativo" ON public.suppliers FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Suppliers delete by Admin only" ON public.suppliers FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- PURCHASES
DROP POLICY IF EXISTS "Purchases viewable by all" ON public.purchases;
DROP POLICY IF EXISTS "Purchases insert by Admin/Operativo" ON public.purchases;
DROP POLICY IF EXISTS "Purchases update by Admin/Operativo" ON public.purchases;
DROP POLICY IF EXISTS "Purchases delete by Admin only" ON public.purchases;

CREATE POLICY "Purchases viewable by all" ON public.purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Purchases insert by Admin/Operativo" ON public.purchases FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Purchases update by Admin/Operativo" ON public.purchases FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Purchases delete by Admin only" ON public.purchases FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- PURCHASE ITEMS
DROP POLICY IF EXISTS "Purchase items viewable by all" ON public.purchase_items;
DROP POLICY IF EXISTS "Purchase items insert by Admin/Operativo" ON public.purchase_items;
DROP POLICY IF EXISTS "Purchase items update by Admin/Operativo" ON public.purchase_items;
DROP POLICY IF EXISTS "Purchase items delete by Admin only" ON public.purchase_items;

CREATE POLICY "Purchase items viewable by all" ON public.purchase_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Purchase items insert by Admin/Operativo" ON public.purchase_items FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Purchase items update by Admin/Operativo" ON public.purchase_items FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Purchase items delete by Admin only" ON public.purchase_items FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- MOVEMENTS
DROP POLICY IF EXISTS "Movements viewable by all" ON public.movements;
DROP POLICY IF EXISTS "Movements insert by Admin/Operativo" ON public.movements;

CREATE POLICY "Movements viewable by all" ON public.movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Movements insert by Admin/Operativo" ON public.movements FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));

