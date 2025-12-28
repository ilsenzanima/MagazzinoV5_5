-- Create extension if not exists (required for uuid_generate_v4)
create extension if not exists "uuid-ossp";

-- Create Workers Table if it doesn't exist
create table if not exists public.workers (
  id uuid default uuid_generate_v4() primary key,
  first_name text not null,
  last_name text not null,
  email text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.workers enable row level security;

-- Drop existing policies to ensure clean state and avoid "policy already exists" errors
drop policy if exists "Workers are viewable by authenticated users." on workers;
drop policy if exists "Operativo and Admin can create workers." on workers;
drop policy if exists "Operativo and Admin can update workers." on workers;
drop policy if exists "Only Admins can delete workers." on workers;

-- 1. Read: Authenticated users can read workers
create policy "Workers are viewable by authenticated users."
  on workers for select
  to authenticated
  using ( true );

-- 2. Create: Only 'operativo' and 'admin' can create
create policy "Operativo and Admin can create workers."
  on workers for insert
  to authenticated
  with check (
     exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'operativo')
    )
  );

-- 3. Update: Only 'operativo' and 'admin' can update
create policy "Operativo and Admin can update workers."
  on workers for update
  to authenticated
  using (
     exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'operativo')
    )
  );

-- 4. Delete: Only 'admin' can delete
create policy "Only Admins can delete workers."
  on workers for delete
  to authenticated
  using (
     exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Function to handle updated_at
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Drop trigger if exists
drop trigger if exists on_worker_updated on public.workers;

-- Trigger for updated_at
create trigger on_worker_updated
  before update on public.workers
  for each row execute procedure public.handle_updated_at();
