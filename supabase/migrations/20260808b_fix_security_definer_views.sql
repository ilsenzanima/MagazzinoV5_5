-- Fix Supabase linter ERROR "Security Definer View" su due viste create di recente
-- (20260801, 20260801b) a cui è sfuggita l'opzione security_invoker, già applicata a
-- tutte le altre viste dello schema (vedi 20251222_fix_security_advisor.sql,
-- 20251226_fix_advisor_warnings.sql, ecc.). Senza questa opzione la vista viene
-- eseguita con i permessi/RLS del proprietario della vista invece che dell'utente
-- che interroga, bypassando le row level security policy delle tabelle sottostanti.
ALTER VIEW public.negative_lot_movements SET (security_invoker = true);
ALTER VIEW public.orphaned_job_references SET (security_invoker = true);
