-- Fix Supabase Security Advisor Issues

-- 1. Fix SECURITY DEFINER View (stock_movements_view)
-- Ensure the view runs with the privileges of the user calling it, enforcing RLS.
-- HANDLED IN DEFINITION FILE: 20251222_update_stock_movements_view_v2.sql
-- ALTER VIEW public.stock_movements_view SET (security_invoker = true);

-- 2. Fix SECURITY DEFINER View (purchase_batch_availability)
ALTER VIEW public.purchase_batch_availability SET (security_invoker = true);

-- 3. Fix Function Search Path Mutable (handle_purchase_item_change)
ALTER FUNCTION public.handle_purchase_item_change() SET search_path = public;

-- 4. Fix Function Search Path Mutable (handle_movement_logic)
ALTER FUNCTION public.handle_movement_logic() SET search_path = public;

-- 5. Fix Function Search Path Mutable (recalculate_inventory_item)
ALTER FUNCTION public.recalculate_inventory_item(uuid) SET search_path = public;

-- 6. Fix Function Search Path Mutable (handle_delivery_note_item_change)
-- This function might be legacy but if it exists, we fix it.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'handle_delivery_note_item_change' 
        AND pronamespace = 'public'::regnamespace
    ) THEN
        ALTER FUNCTION public.handle_delivery_note_item_change() SET search_path = public;
    END IF;
END
$$;

-- 7. Fix update_user_role if it exists (suspected legacy or RPC)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'update_user_role' 
        AND pronamespace = 'public'::regnamespace
    ) THEN
        -- We attempt to set search_path. The signature is unknown, so we try to find it.
        -- If multiple signatures exist, this dynamic SQL might need adjustment, but usually there's one.
        -- We'll just skip precise signature matching and rely on name if possible, 
        -- but ALTER FUNCTION requires signature.
        -- Let's assume (uuid, text) as used in the app, or (uuid, varchar), etc.
        -- A safer bet is to ignore if we can't determine it, but the user wants it fixed.
        -- Let's try the most likely signature from previous context or standard usage.
        -- If it fails, it fails in the DO block? No, ALTER inside DO is fine.
        -- Actually, we can query pg_proc to construct the ALTER statement.
        DECLARE
            func_sig text;
        BEGIN
            SELECT pg_catalog.pg_get_function_identity_arguments(oid)
            INTO func_sig
            FROM pg_proc
            WHERE proname = 'update_user_role'
            AND pronamespace = 'public'::regnamespace
            LIMIT 1;

            IF func_sig IS NOT NULL THEN
                EXECUTE format('ALTER FUNCTION public.update_user_role(%s) SET search_path = public', func_sig);
            END IF;
        END;
    END IF;
END
$$;
