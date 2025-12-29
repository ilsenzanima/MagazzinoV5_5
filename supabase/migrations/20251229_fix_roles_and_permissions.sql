-- FIX SCRIPT: Restore Admin Role and Ensure Visibility
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Ripristina il ruolo ADMIN per l'utente specifico
--    Cerca per email (più sicuro che cercare per ID)
UPDATE public.profiles
SET role = 'admin'
WHERE email LIKE 'a.dagostino@%'
   OR email LIKE 'info@opifiresafety%'; -- aggiungi altre email se necessario

-- 2. Garantisci visibilità su Delivery Notes (Bollatrici)
--    Rimuove eventuali policy restrittive e ne applica una aperta a tutti gli autenticati
DROP POLICY IF EXISTS "Delivery notes viewable by all" ON public.delivery_notes;
CREATE POLICY "Delivery notes viewable by all" 
ON public.delivery_notes FOR SELECT 
TO authenticated 
USING (true);

-- 3. Garantisci visibilità su Jobs (Commesse)
--    Necessario per vedere i dettagli della commessa nella lista movimenti
DROP POLICY IF EXISTS "Jobs viewable by all" ON public.jobs;
CREATE POLICY "Jobs viewable by all" 
ON public.jobs FOR SELECT 
TO authenticated 
USING (true);

-- 4. Garantisci visibilità su Items (Righe bolla)
DROP POLICY IF EXISTS "Delivery note items viewable by all" ON public.delivery_note_items;
CREATE POLICY "Delivery note items viewable by all" 
ON public.delivery_note_items FOR SELECT 
TO authenticated 
USING (true);

-- 5. Per sicurezza, assicuriamoci che i profili siano leggibili (per vedere chi ha creato la bolla)
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Output di verifica
SELECT 'Check Ruolo' as test, email, role FROM public.profiles WHERE email LIKE 'a.dagostino@%';
