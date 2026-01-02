-- Add 'name' column to jobs table
ALTER TABLE public.jobs ADD COLUMN name text;

-- Populate 'name' with existing 'description' (fallback)
UPDATE public.jobs SET name = description;

-- Set 'name' as NOT NULL
ALTER TABLE public.jobs ALTER COLUMN name SET NOT NULL;

-- Make 'description' NOT NULL? No, user requested it to be optional.
-- But it was likely NOT NULL before. Let's check or just drop constraint if exists.
ALTER TABLE public.jobs ALTER COLUMN description DROP NOT NULL;
