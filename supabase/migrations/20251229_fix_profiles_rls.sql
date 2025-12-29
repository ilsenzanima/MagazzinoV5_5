-- =====================================================
-- FIX: Correzione RLS Policies per tabella profiles
-- =====================================================
-- Versione 2 - Idempotente (gestisce policies esistenti)
-- =====================================================

-- 1. Rimuovere TUTTE le policy esistenti su profiles per ripartire puliti
DROP POLICY IF EXISTS "Users and Admins can update profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by all" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

-- 2. Ricreare le policy in modo pulito
-- SELECT: tutti gli autenticati possono leggere tutti i profili
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: solo il proprio profilo
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- UPDATE: solo il proprio profilo
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Verifica finale
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';
