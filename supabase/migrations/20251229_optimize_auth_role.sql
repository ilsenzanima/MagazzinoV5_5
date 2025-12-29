-- Migration: Ottimizzazione Funzione Ruolo per RLS
-- Data: 2025-12-29
-- Descrizione: Crea funzione auth_role() ottimizzata che usa JWT claims invece di query DB

-- =====================================================
-- FUNZIONE auth_role() OTTIMIZZATA
-- =====================================================
-- Questa funzione legge il ruolo direttamente dai JWT claims
-- senza fare query al database, molto più veloce di get_my_role()

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Prova a leggere il ruolo dai metadata JWT
  -- Se non presente, fallback a query profiles (per retrocompatibilità)
  SELECT COALESCE(
    -- Prima opzione: ruolo nei JWT claims (custom claim)
    nullif(current_setting('request.jwt.claims', true)::json->>'user_role', ''),
    -- Seconda opzione: query database (fallback)
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    -- Default: user
    'user'
  )::text;
$$;

-- Commento descrittivo
COMMENT ON FUNCTION public.auth_role() IS 
'Funzione ottimizzata per ottenere il ruolo utente. Preferisce JWT claims, fallback a DB.';

-- =====================================================
-- AGGIORNAMENTO get_my_role() PER COMPATIBILITÀ
-- =====================================================
-- Rende get_my_role() un alias di auth_role() per retrocompatibilità
-- Le policy esistenti continueranno a funzionare

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_role();
$$;

COMMENT ON FUNCTION public.get_my_role() IS 
'Wrapper per retrocompatibilità. Usa auth_role() internamente.';
