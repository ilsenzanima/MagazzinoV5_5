-- =====================================================
-- FIX: Permettere agli admin di modificare i profili di tutti gli utenti
-- =====================================================
-- Problema: La policy "Users can update own profile" permette solo
-- a un utente di modificare il proprio profilo. Gli admin devono
-- poter modificare anche i profili degli altri utenti.
-- =====================================================

-- 1. Rimuovere la vecchia policy di update
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 2. Creare nuova policy: utenti possono modificare il proprio profilo
-- OPPURE admin possono modificare qualsiasi profilo
CREATE POLICY "Users and Admins can update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id 
    OR 
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  );

-- 3. Aggiungere policy DELETE per admin
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  );
