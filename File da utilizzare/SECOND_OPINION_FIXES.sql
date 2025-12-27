-- ==========================================
-- SECOND OPINION FIXES
-- ==========================================
-- Based on d:\Magazzino\MagazzinoV5_5\File da utilizzare\seconndo parere.txt

-- 1. FIX INDEXES FOR RLS PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_id_role ON public.profiles(id, role);
CREATE INDEX IF NOT EXISTS idx_inventory_code ON public.inventory(code);

-- 2. FIX ROLE CONSTRAINT
-- ==========================================
-- Allow 'operativo' role in profiles table
DO $$
BEGIN
    -- Drop the constraint if it exists (handling potential naming variations)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check') THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
    END IF;
    
    -- Add the new constraint
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'user', 'operativo'));
END $$;
