-- auth_role() previously trusted the JWT's baked-in "user_role" claim first,
-- falling back to a live lookup of profiles.role only if the claim was
-- missing. That claim is set once at login/token-refresh time by
-- custom_access_token_hook, so it can lag behind the real, current role in
-- profiles for the lifetime of that access token (and, per a real incident
-- where an operativo was twice rejected deleting a purchase they were
-- entitled to delete, appears to occasionally desync even without a role
-- change, causing a genuine operativo/admin to be treated as a lower role
-- and rejected by RLS with a confusing "row-level security" error).
--
-- Flip the priority: always read the live role from public.profiles first
-- (protected by a permissive `qual: true` SELECT policy, so this never
-- fails for an authenticated user), and use the JWT claim only as a
-- fallback if that lookup returns nothing. This removes the class of
-- stale-token permission errors at the cost of one extra indexed lookup
-- per RLS check, which is negligible at this project's scale.
CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    nullif(current_setting('request.jwt.claims', true)::json->>'user_role', ''),
    'user'
  )::text;
$function$;
