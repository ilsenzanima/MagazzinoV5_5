-- Enable 'operativo' role in profiles table
-- This migration updates the check constraint on the profiles table to allow 'operativo' role.

DO $$
BEGIN
    -- Drop the constraint if it exists (handling potential naming variations)
    -- We try to target the specific constraint name 'profiles_role_check'
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check') THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
    END IF;
    
    -- Add the new constraint with the expanded role list
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'user', 'operativo'));
END $$;
