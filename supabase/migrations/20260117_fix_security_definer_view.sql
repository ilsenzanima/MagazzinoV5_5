-- Fix security definer view warning from Supabase linter
-- Change purchase_item_job_movements view to SECURITY INVOKER

ALTER VIEW public.purchase_item_job_movements SET (security_invoker = on);
