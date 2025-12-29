-- Ensure 'real_quantity' column exists (used for inventory audit)
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS real_quantity NUMERIC DEFAULT NULL;

-- Ensure 'model' column exists (used for item variants)
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS model TEXT DEFAULT NULL;

-- Force schema cache reload (Supabase sometimes caches schema)
NOTIFY pgrst, 'reload schema';
