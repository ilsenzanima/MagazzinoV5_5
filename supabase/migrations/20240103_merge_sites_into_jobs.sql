-- Drop sites table if it exists (since we are merging concepts)
drop table if exists public.sites;

-- Alter jobs table to add new fields
alter table public.jobs 
add column if not exists site_address text,
add column if not exists site_manager text,
add column if not exists cig text,
add column if not exists cup text;

-- Optional: Rename jobs to 'commesse' if preferred, but 'jobs' is standard. 
-- We keep 'jobs' table name but conceptually it now includes site info.
