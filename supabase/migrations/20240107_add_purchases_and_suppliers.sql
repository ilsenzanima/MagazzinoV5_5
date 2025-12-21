-- Create Suppliers table
create table public.suppliers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  vat_number text,
  email text,
  phone text,
  address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Purchases table
create table public.purchases (
  id uuid default uuid_generate_v4() primary key,
  supplier_id uuid references public.suppliers(id) on delete restrict not null,
  delivery_note_number text not null,
  delivery_note_date date not null,
  status text check (status in ('draft', 'completed')) default 'draft',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Purchase Items table
create table public.purchase_items (
  id uuid default uuid_generate_v4() primary key,
  purchase_id uuid references public.purchases(id) on delete cascade not null,
  item_id uuid references public.inventory(id) on delete restrict not null,
  quantity numeric(10, 2) not null check (quantity > 0),
  price numeric(10, 2) not null check (price >= 0),
  job_id uuid references public.jobs(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;

-- Policies for Suppliers
create policy "Suppliers are viewable by authenticated users."
  on suppliers for select
  to authenticated
  using ( true );

create policy "Authenticated users can create suppliers."
  on suppliers for insert
  to authenticated
  with check ( true );

create policy "Authenticated users can update suppliers."
  on suppliers for update
  to authenticated
  using ( true );

-- Policies for Purchases
create policy "Purchases are viewable by authenticated users."
  on purchases for select
  to authenticated
  using ( true );

create policy "Authenticated users can create purchases."
  on purchases for insert
  to authenticated
  with check ( auth.uid() = created_by );

create policy "Authenticated users can update purchases."
  on purchases for update
  to authenticated
  using ( true );

-- Policies for Purchase Items
create policy "Purchase items are viewable by authenticated users."
  on purchase_items for select
  to authenticated
  using ( true );

create policy "Authenticated users can create purchase items."
  on purchase_items for insert
  to authenticated
  with check ( true );

create policy "Authenticated users can update purchase items."
  on purchase_items for update
  to authenticated
  using ( true );
