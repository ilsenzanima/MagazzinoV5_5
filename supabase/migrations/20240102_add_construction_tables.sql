-- Create Clients (Committenti) table
create table public.clients (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  vat_number text,
  address text,
  email text,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Jobs (Commesse) table
create table public.jobs (
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

-- Create Sites (Cantieri) table
create table public.sites (
  id uuid default uuid_generate_v4() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  name text not null,
  address text,
  manager text,
  status text check (status in ('active', 'inactive', 'completed')) default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add job_id to movements table for linking movements to jobs
alter table public.movements 
add column job_id uuid references public.jobs(id);

-- Enable RLS
alter table public.clients enable row level security;
alter table public.jobs enable row level security;
alter table public.sites enable row level security;

-- Policies for Clients
create policy "Clients are viewable by authenticated users."
  on clients for select
  to authenticated
  using ( true );

create policy "Authenticated users can create clients."
  on clients for insert
  to authenticated
  with check ( true );

create policy "Authenticated users can update clients."
  on clients for update
  to authenticated
  using ( true );

-- Policies for Jobs
create policy "Jobs are viewable by authenticated users."
  on jobs for select
  to authenticated
  using ( true );

create policy "Authenticated users can create jobs."
  on jobs for insert
  to authenticated
  with check ( true );

create policy "Authenticated users can update jobs."
  on jobs for update
  to authenticated
  using ( true );

-- Policies for Sites
create policy "Sites are viewable by authenticated users."
  on sites for select
  to authenticated
  using ( true );

create policy "Authenticated users can create sites."
  on sites for insert
  to authenticated
  with check ( true );

create policy "Authenticated users can update sites."
  on sites for update
  to authenticated
  using ( true );
