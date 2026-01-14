-- Script per aggiungere utente esterno (non @opifiresafe.com)
-- Email: amministrazione@errevisystem.com
-- Nome: Luisa Bertogna
-- Password: Magazzino2026!Luisa

-- PASSO 1: Esegui questo comando nel Dashboard Supabase > Authentication > Users > Add User
-- Email: amministrazione@errevisystem.com
-- Password: Magazzino2026!Luisa
-- (oppure via API se preferisci)

-- PASSO 2: Dopo aver creato l'utente in Authentication, esegui questo SQL per creare il profilo
-- Sostituisci 'USER_UUID_HERE' con l'UUID dell'utente appena creato

-- Prima recupera l'UUID dell'utente
SELECT id, email FROM auth.users WHERE email = 'amministrazione@errevisystem.com';

-- Poi inserisci il profilo (sostituisci l'UUID)
INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
SELECT 
    id,
    'amministrazione@errevisystem.com',
    'Luisa Bertogna',
    'user',  -- oppure 'operativo' o 'admin' a seconda dei permessi desiderati
    NOW(),
    NOW()
FROM auth.users
WHERE email = 'amministrazione@errevisystem.com'
ON CONFLICT (id) DO UPDATE SET
    full_name = 'Luisa Bertogna',
    updated_at = NOW();

-- Verifica
SELECT * FROM public.profiles WHERE email = 'amministrazione@errevisystem.com';
