-- Create Brands table
create table public.brands (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Item Types table
create table public.item_types (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.brands enable row level security;
alter table public.item_types enable row level security;

-- Policies for Brands
create policy "Brands are viewable by authenticated users."
  on brands for select
  to authenticated
  using ( true );

create policy "Authenticated users can create brands."
  on brands for insert
  to authenticated
  with check ( true );

create policy "Authenticated users can delete brands."
  on brands for delete
  to authenticated
  using ( true );

-- Policies for Item Types
create policy "Item Types are viewable by authenticated users."
  on item_types for select
  to authenticated
  using ( true );

create policy "Authenticated users can create item_types."
  on item_types for insert
  to authenticated
  with check ( true );

create policy "Authenticated users can delete item_types."
  on item_types for delete
  to authenticated
  using ( true );

-- Seed Initial Data
insert into public.brands (name) values 
('Makita'), ('Bosch'), ('Stanley'), ('Beta'), ('Wurth'), ('3M'), ('DeWalt'), ('Hilti'), ('Usag')
on conflict (name) do nothing;

insert into public.item_types (name) values 
('Elettroutensili'), ('Utensili Manuali'), ('Ferramenta'), ('DPI'), ('Materiale Elettrico'), ('Idraulica'), ('Consumabili')
on conflict (name) do nothing;
