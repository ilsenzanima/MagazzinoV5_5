-- Fix Function Search Path Mutable warnings
-- Set search_path for all functions to prevent search path injection attacks

-- 1. ensure_single_primary_warehouse
ALTER FUNCTION public.ensure_single_primary_warehouse() SET search_path = public;

-- 2. prevent_admin_deletion
ALTER FUNCTION public.prevent_admin_deletion() SET search_path = public;

-- 3. get_dashboard_stats
ALTER FUNCTION public.get_dashboard_stats() SET search_path = public;

-- 4. get_low_stock_inventory
ALTER FUNCTION public.get_low_stock_inventory() SET search_path = public;

-- 5. get_inventory_search (if exists with different signatures)
DO $$
BEGIN
    ALTER FUNCTION public.get_inventory_search(text) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- 6. check_inventory_duplicate
DO $$
BEGIN
    ALTER FUNCTION public.check_inventory_duplicate(text, text, uuid) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- 7. handle_updated_at
ALTER FUNCTION public.handle_updated_at() SET search_path = public;

-- 8. recalculate_all_inventory
ALTER FUNCTION public.recalculate_all_inventory() SET search_path = public;

-- 9. recalculate_all_job_inventory
ALTER FUNCTION public.recalculate_all_job_inventory() SET search_path = public;

-- 10. handle_delivery_note_delete
ALTER FUNCTION public.handle_delivery_note_delete() SET search_path = public;

-- 11. log_inventory_anomaly
DO $$
BEGIN
    ALTER FUNCTION public.log_inventory_anomaly(uuid, text, numeric, text) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- 12. handle_movement_logic
ALTER FUNCTION public.handle_movement_logic() SET search_path = public;

-- 13. check_purchase_item_usage
ALTER FUNCTION public.check_purchase_item_usage() SET search_path = public;

-- 14. recalculate_inventory_item
DO $$
BEGIN
    ALTER FUNCTION public.recalculate_inventory_item(uuid) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- 15. check_inventory_integrity
ALTER FUNCTION public.check_inventory_integrity() SET search_path = public;

-- 16. validate_movement_stock
ALTER FUNCTION public.validate_movement_stock() SET search_path = public;

-- 17. update_fictitious_price_timestamp
ALTER FUNCTION public.update_fictitious_price_timestamp() SET search_path = public;

-- Additional functions that might exist
DO $$
BEGIN
    ALTER FUNCTION public.get_job_total_cost(uuid) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
    ALTER FUNCTION public.recalculate_job_inventory_item(uuid, uuid) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
    ALTER FUNCTION public.handle_new_user() SET search_path = public, auth;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;
