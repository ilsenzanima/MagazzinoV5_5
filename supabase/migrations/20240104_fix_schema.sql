-- Ensure clients table exists and has new columns
create table if not exists public.clients (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  vat_number text,
  address text, -- Legacy field, kept for compatibility
  email text,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add split address columns if they don't exist
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'street') then
    alter table public.clients add column street text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'street_number') then
    alter table public.clients add column street_number text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'postal_code') then
    alter table public.clients add column postal_code text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'city') then
    alter table public.clients add column city text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'province') then
    alter table public.clients add column province text;
  end if;
end $$;

-- Ensure jobs table exists
create table if not exists public.jobs (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  code text unique,
  description text not null,
  status text check (status in ('active', 'completed', 'suspended')) default 'active',
  start_date date,
  end_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add new job columns (merged from sites)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'jobs' and column_name = 'site_address') then
    alter table public.jobs add column site_address text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'jobs' and column_name = 'site_manager') then
    alter table public.jobs add column site_manager text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'jobs' and column_name = 'cig') then
    alter table public.jobs add column cig text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'jobs' and column_name = 'cup') then
    alter table public.jobs add column cup text;
  end if;
end $$;

-- Ensure movements has job_id
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'movements' and column_name = 'job_id') then
    alter table public.movements add column job_id uuid references public.jobs(id);
  end if;
end $$;

-- Enable RLS
alter table public.clients enable row level security;
alter table public.jobs enable row level security;

-- Re-apply policies (drop first to avoid errors)
drop policy if exists "Clients are viewable by authenticated users." on clients;
drop policy if exists "Authenticated users can create clients." on clients;
drop policy if exists "Authenticated users can update clients." on clients;

create policy "Clients are viewable by authenticated users." on clients for select to authenticated using ( true );
create policy "Authenticated users can create clients." on clients for insert to authenticated with check ( true );
create policy "Authenticated users can update clients." on clients for update to authenticated using ( true );

drop policy if exists "Jobs are viewable by authenticated users." on jobs;
drop policy if exists "Authenticated users can create jobs." on jobs;
drop policy if exists "Authenticated users can update jobs." on jobs;

create policy "Jobs are viewable by authenticated users." on jobs for select to authenticated using ( true );
create policy "Authenticated users can create jobs." on jobs for insert to authenticated with check ( true );
create policy "Authenticated users can update jobs." on jobs for update to authenticated using ( true );
