-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles Table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  role text check (role in ('admin', 'user')) default 'user',
  avatar_url text,
  updated_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Inventory Table
create table public.inventory (
  id uuid default uuid_generate_v4() primary key,
  code text unique not null,
  name text not null,
  brand text,
  category text,
  quantity integer default 0,
  min_stock integer default 0,
  description text,
  image_url text,
  price numeric(10,2),
  location text,
  unit text check (unit in ('PZ', 'ML', 'MQ', 'KG', 'L')) default 'PZ',
  coefficient numeric(10,2) default 1.0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.inventory enable row level security;

create policy "Inventory is viewable by authenticated users."
  on inventory for select
  to authenticated
  using ( true );

create policy "Only admins can modify inventory."
  on inventory for all
  to authenticated
  using ( 
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- 3. Movements Table
create table public.movements (
  id uuid default uuid_generate_v4() primary key,
  item_id uuid references public.inventory(id) on delete cascade not null,
  user_id uuid references auth.users(id),
  type text check (type in ('load', 'unload')) not null,
  quantity integer not null,
  reference text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.movements enable row level security;

create policy "Movements are viewable by authenticated users."
  on movements for select
  to authenticated
  using ( true );

create policy "Authenticated users can create movements."
  on movements for insert
  to authenticated
  with check ( auth.uid() = user_id );
