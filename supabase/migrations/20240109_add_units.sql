-- Create units table
create table public.units (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.units enable row level security;

-- Create policies
create policy "Units are viewable by authenticated users."
  on units for select
  to authenticated
  using ( true );

create policy "Units are insertable by authenticated users."
  on units for insert
  to authenticated
  with check ( true );

create policy "Units are deletable by authenticated users."
  on units for delete
  to authenticated
  using ( true );

-- Seed initial data
insert into public.units (name) values
  ('PZ'),
  ('ML'),
  ('MQ'),
  ('KG'),
  ('L');
