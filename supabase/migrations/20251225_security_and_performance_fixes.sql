-- Fix Security Advisor: Security Definer View
-- Views that access data usually should use the invoker's permissions to respect RLS
ALTER VIEW public.purchase_batch_availability SET (security_invoker = on);

-- Fix Security Advisor: Function Search Path Mutable
-- Set search_path to public for security definer functions to prevent path hijacking
ALTER FUNCTION public.handle_purchase_item_change() SET search_path = public;
ALTER FUNCTION public.handle_movement_logic() SET search_path = public;
ALTER FUNCTION public.recalculate_inventory_item(uuid) SET search_path = public;
ALTER FUNCTION public.check_purchase_deletion_safety() SET search_path = public;
