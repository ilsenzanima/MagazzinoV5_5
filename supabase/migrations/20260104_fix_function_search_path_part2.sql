-- Fix remaining Function Search Path Mutable warnings (part 2)
-- These functions have different signatures than previously assumed

-- 1. get_inventory_search (correct signature: text, text, int, int)
ALTER FUNCTION public.get_inventory_search(text, text, int, int) SET search_path = public;

-- 2. check_inventory_duplicate (correct signature: text, text, text, text)
ALTER FUNCTION public.check_inventory_duplicate(text, text, text, text) SET search_path = public;

-- 3. log_inventory_anomaly (correct signature: no params - it's a trigger function)
ALTER FUNCTION public.log_inventory_anomaly() SET search_path = public;
