-- =====================================================
-- SCRIPT DI VERIFICA E FIX DATABASE
-- Esegui questo su Supabase SQL Editor
-- =====================================================

-- 1. VERIFICA: La colonna 'name' esiste in jobs?
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'jobs' AND column_name = 'name';

-- Se non restituisce risultati, la colonna manca. Aggiungerla con:
-- ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS name text;
-- UPDATE public.jobs SET name = COALESCE(description, code) WHERE name IS NULL;
-- ALTER TABLE public.jobs ALTER COLUMN name SET NOT NULL;

-- 2. VERIFICA: Esistono i trigger problematici?
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND trigger_name IN ('validate_movement_stock_trigger', 'log_inventory_anomaly_trigger');

-- 3. VERIFICA: Stato del trigger handle_movement_logic
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND trigger_name = 'on_delivery_note_item_change';

-- 4. VERIFICA: La funzione handle_movement_logic è presente?
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'handle_movement_logic';

-- =====================================================
-- SE CI SONO PROBLEMI, ESEGUI QUESTO BLOCCO DI FIX:
-- =====================================================

-- A. Rimuovi trigger problematici (se esistono)
DROP TRIGGER IF EXISTS validate_movement_stock_trigger ON public.delivery_note_items;

-- B. Assicura che la colonna name esista
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'name'
    ) THEN
        ALTER TABLE public.jobs ADD COLUMN name text;
        UPDATE public.jobs SET name = COALESCE(description, code);
        ALTER TABLE public.jobs ALTER COLUMN name SET NOT NULL;
    END IF;
END $$;

-- C. Assicura description sia nullable
ALTER TABLE public.jobs ALTER COLUMN description DROP NOT NULL;

-- D. Verifica finale
SELECT 'Jobs table check:' as info, column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'jobs' AND column_name IN ('name', 'description');
