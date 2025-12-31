-- ==============================================================================
-- SCRIPT CONFIGURAZIONE JWT CUSTOM CLAIMS (Supabase Auth Hooks)
-- ==============================================================================
-- Esegui questo script nell'SQL Editor della tua Dashboard Supabase.
-- Questo script crea la funzione necessaria per iniettare il 'user_role' nel token JWT.
-- ==============================================================================

-- 1. Crea la funzione Hook
-- Questa funzione viene chiamata ogni volta che Supabase genera un token.
-- Legge il ruolo da public.profiles e lo inserisce nel JWT.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  -- 1. Cerca il ruolo utente nella tabella profiles
  SELECT role INTO user_role 
  FROM public.profiles 
  WHERE id = (event->>'user_id')::uuid;

  -- 2. Ottieni i claims attuali
  claims := event->'claims';

  -- 3. Se il ruolo esiste, iniettalo nei claims
  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  ELSE
    -- Default fallback se non trovato (es. 'user')
    claims := jsonb_set(claims, '{user_role}', '"user"');
  END IF;

  -- 4. Aggiorna l'evento con i nuovi claims
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;

-- 2. Assegna Permessi
-- Importante: Solo il sistema di Auth deve poter eseguire questa funzione
GRANT ALL ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

REVOKE ALL ON FUNCTION public.custom_access_token_hook FROM public, anon, authenticated;

-- ==============================================================================
-- ISTRUZIONI FINALI:
-- Dopo aver eseguito questo script, devi attivare l'hook dalla Dashboard:
-- 1. Vai su Authentication -> Hooks (nel menu laterale)
-- 2. Cerca la voce "Custom Access Token" (o "Customize Access Token")
-- 3. Clicca su "Add Hook" o "Edit"
-- 4. Seleziona il tipo "PostgreSQL Function"
-- 5. Seleziona la funzione "public.custom_access_token_hook" appena creata
-- 6. Salva/Abilita
-- ==============================================================================
