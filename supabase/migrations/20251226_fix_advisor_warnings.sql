-- Fix Security Advisor Issue: Security Definer View
-- Re-defining the view to ensure it includes the "Direct-to-Site" exclusion logic (from 20251224_fix_purchase_job_trigger.sql)
-- AND has security_invoker = true (Security Best Practice)

CREATE OR REPLACE VIEW public.purchase_batch_availability WITH (security_invoker = true) AS
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
WHERE p.job_id IS NULL -- Exclude direct-to-site purchases
AND (
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


-- Fix Performance Advisor Issue: Permissive Policies on public.inventory_supplier_codes
-- Remove overly permissive "FOR ALL" policies
DROP POLICY IF EXISTS "Supplier codes modifiable by authenticated" ON public.inventory_supplier_codes;
DROP POLICY IF EXISTS "Inventory supplier codes modifiable by authenticated" ON public.inventory_supplier_codes;

-- Create granular policies
CREATE POLICY "Supplier codes viewable by authenticated" ON public.inventory_supplier_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supplier codes insert by Admin/Operativo" ON public.inventory_supplier_codes FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Supplier codes update by Admin/Operativo" ON public.inventory_supplier_codes FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Supplier codes delete by Admin only" ON public.inventory_supplier_codes FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');


-- Fix Performance Advisor Issue: Permissive Policies on public.job_inventory
DROP POLICY IF EXISTS "Job Inventory modifiable by authenticated" ON public.job_inventory;
-- Note: "Job Inventory viewable by authenticated" is kept (or recreated if needed, but usually safe)

-- Create granular policies for modification
CREATE POLICY "Job Inventory insert by Admin/Operativo" ON public.job_inventory FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Job Inventory update by Admin/Operativo" ON public.job_inventory FOR UPDATE TO authenticated USING (public.get_my_role() IN ('admin', 'operativo'));
CREATE POLICY "Job Inventory delete by Admin only" ON public.job_inventory FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');


-- Fix Performance Advisor Issue: Permissive Policies on public.profiles
-- Drop potentially permissive policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by all" ON public.profiles;

-- Recreate with authenticated restriction (no public access)
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
-- Allow Admins to update any profile
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin');


-- Fix/Ensure handle_purchase_item_change is Secure AND Functional
-- Merges logic from 20251224_fix_purchase_job_trigger.sql (Direct-to-Site logic)
-- with Security Best Practices (search_path = public)
-- and Pieces logic (from 20251224_definitive_security_fix.sql)

CREATE OR REPLACE FUNCTION public.handle_purchase_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item_coeff NUMERIC;
    v_job_id UUID;
BEGIN
    -- Get coefficient
    SELECT coefficient INTO item_coeff FROM public.inventory WHERE id = COALESCE(NEW.item_id, OLD.item_id);
    IF item_coeff IS NULL OR item_coeff = 0 THEN item_coeff := 1; END IF;

    -- Get job_id from parent purchase
    IF TG_OP = 'DELETE' THEN
        SELECT job_id INTO v_job_id FROM public.purchases WHERE id = OLD.purchase_id;
    ELSE
        SELECT job_id INTO v_job_id FROM public.purchases WHERE id = NEW.purchase_id;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF v_job_id IS NOT NULL THEN
            -- Direct to Job Site -> Update Job Inventory
            INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
            VALUES (v_job_id, NEW.item_id, NEW.pieces, NEW.quantity)
            ON CONFLICT (job_id, item_id) 
            DO UPDATE SET 
                pieces = job_inventory.pieces + EXCLUDED.pieces,
                quantity = job_inventory.quantity + EXCLUDED.quantity,
                updated_at = now();
        ELSE
            -- To Warehouse -> Update Main Inventory
            UPDATE public.inventory
            SET pieces = pieces + NEW.pieces,
                quantity = quantity + NEW.quantity
            WHERE id = NEW.item_id;
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        IF v_job_id IS NOT NULL THEN
            -- Remove from Job Site
            UPDATE public.job_inventory
            SET pieces = pieces - OLD.pieces,
                quantity = quantity - OLD.quantity,
                updated_at = now()
            WHERE job_id = v_job_id AND item_id = OLD.item_id;
        ELSE
            -- Remove from Warehouse
            UPDATE public.inventory
            SET pieces = pieces - OLD.pieces,
                quantity = quantity - OLD.quantity
            WHERE id = OLD.item_id;
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle potential change in quantities/pieces
        -- (Assuming purchase doesn't move between jobs for simplicity, though theoretically possible)
        IF v_job_id IS NOT NULL THEN
             UPDATE public.job_inventory
             SET pieces = pieces - OLD.pieces + NEW.pieces,
                 quantity = quantity - OLD.quantity + NEW.quantity,
                 updated_at = now()
             WHERE job_id = v_job_id AND item_id = NEW.item_id;
        ELSE
             UPDATE public.inventory
             SET pieces = pieces - OLD.pieces + NEW.pieces,
                 quantity = quantity - OLD.quantity + NEW.quantity
             WHERE id = NEW.item_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;
