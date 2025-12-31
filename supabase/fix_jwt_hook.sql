-- ==============================================================================
-- FIX PER ERRORE LOGIN (PERMESSI HOOK)
-- ==============================================================================
-- La funzione hook falliva perché mancava "SECURITY DEFINER".
-- Esegui questo script per aggiornare la funzione e correggere i permessi.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- <--- IMPORTANTE: Esegue con privilegi di admin
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  -- Cerca il ruolo. Grazie a SECURITY DEFINER ora può leggere la tabella profiles
  -- bypassando RLS e permessi limitati dell'utente in fase di login
  SELECT role INTO user_role 
  FROM public.profiles 
  WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  ELSE
    claims := jsonb_set(claims, '{user_role}', '"user"');
  END IF;

  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;

-- Riassegna i permessi corretti
GRANT ALL ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE ALL ON FUNCTION public.custom_access_token_hook FROM public, anon, authenticated;

-- Per sicurezza extra, garantiamo accesso esplicito
GRANT SELECT ON TABLE public.profiles TO supabase_auth_admin;
