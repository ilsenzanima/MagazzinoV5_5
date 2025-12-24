-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.brands (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT brands_pkey PRIMARY KEY (id)
);
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  vat_number text,
  address text,
  email text,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  street text,
  street_number text,
  postal_code text,
  city text,
  province text,
  CONSTRAINT clients_pkey PRIMARY KEY (id)
);
CREATE TABLE public.delivery_note_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  delivery_note_id uuid NOT NULL,
  inventory_id uuid NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0::numeric),
  price numeric,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  pieces numeric,
  coefficient numeric DEFAULT 1.0,
  purchase_item_id uuid,
  is_fictitious boolean DEFAULT false,
  CONSTRAINT delivery_note_items_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_note_items_purchase_item_id_fkey FOREIGN KEY (purchase_item_id) REFERENCES public.purchase_items(id),
  CONSTRAINT delivery_note_items_delivery_note_id_fkey FOREIGN KEY (delivery_note_id) REFERENCES public.delivery_notes(id),
  CONSTRAINT delivery_note_items_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id)
);
CREATE TABLE public.delivery_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type = ANY (ARRAY['entry'::text, 'exit'::text, 'sale'::text])),
  number text NOT NULL,
  date date NOT NULL,
  job_id uuid,
  causal text,
  pickup_location text,
  delivery_location text,
  transport_mean text,
  appearance text,
  packages_count integer DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  transport_time time without time zone,
  created_by uuid,
  CONSTRAINT delivery_notes_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_notes_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT delivery_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.inventory (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  brand text,
  category text,
  quantity numeric NOT NULL DEFAULT 0,
  min_stock integer DEFAULT 0,
  description text,
  image_url text,
  price numeric,
  location text,
  unit text DEFAULT 'PZ'::text CHECK (unit = ANY (ARRAY['PZ'::text, 'ML'::text, 'MQ'::text, 'KG'::text, 'L'::text])),
  coefficient numeric DEFAULT 1.0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  supplier_code text,
  pieces numeric NOT NULL DEFAULT 0,
  CONSTRAINT inventory_pkey PRIMARY KEY (id)
);
CREATE TABLE public.item_types (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  image_url text,
  CONSTRAINT item_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.job_documents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  job_id uuid NOT NULL,
  name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  category text,
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT job_documents_pkey PRIMARY KEY (id),
  CONSTRAINT job_documents_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT job_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.job_inventory (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  item_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  pieces numeric NOT NULL DEFAULT 0,
  CONSTRAINT job_inventory_pkey PRIMARY KEY (id),
  CONSTRAINT job_inventory_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT job_inventory_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory(id)
);
CREATE TABLE public.job_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  job_id uuid NOT NULL,
  user_id uuid,
  date date NOT NULL DEFAULT CURRENT_DATE,
  content text NOT NULL,
  weather_info jsonb,
  tags ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT job_logs_pkey PRIMARY KEY (id),
  CONSTRAINT job_logs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT job_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.jobs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  client_id uuid NOT NULL,
  code text UNIQUE,
  description text NOT NULL,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'suspended'::text])),
  start_date date,
  end_date date,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  site_address text,
  site_manager text,
  cig text,
  cup text,
  CONSTRAINT jobs_pkey PRIMARY KEY (id),
  CONSTRAINT jobs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id)
);
CREATE TABLE public.movements (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  item_id uuid NOT NULL,
  user_id uuid,
  type text NOT NULL CHECK (type = ANY (ARRAY['load'::text, 'unload'::text])),
  quantity integer NOT NULL,
  reference text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  job_id uuid,
  CONSTRAINT movements_pkey PRIMARY KEY (id),
  CONSTRAINT movements_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory(id),
  CONSTRAINT movements_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT movements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text,
  full_name text,
  role text DEFAULT 'user'::text CHECK (role = ANY (ARRAY['admin'::text, 'user'::text])),
  avatar_url text,
  updated_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.purchase_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  purchase_id uuid NOT NULL,
  item_id uuid NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0::numeric),
  price numeric NOT NULL CHECK (price >= 0::numeric),
  job_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  pieces numeric,
  coefficient numeric DEFAULT 1.0,
  CONSTRAINT purchase_items_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id),
  CONSTRAINT purchase_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory(id),
  CONSTRAINT purchase_items_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);
CREATE TABLE public.purchases (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  supplier_id uuid NOT NULL,
  delivery_note_number text NOT NULL,
  delivery_note_date date NOT NULL,
  status text DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'completed'::text])),
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  job_id uuid,
  document_url text,
  CONSTRAINT purchases_pkey PRIMARY KEY (id),
  CONSTRAINT purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id),
  CONSTRAINT purchases_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT purchases_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.sites (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  job_id uuid NOT NULL,
  name text NOT NULL,
  address text,
  manager text,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'completed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT sites_pkey PRIMARY KEY (id),
  CONSTRAINT sites_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);
CREATE TABLE public.suppliers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  vat_number text,
  email text,
  phone text,
  address text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT suppliers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.units (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT units_pkey PRIMARY KEY (id)
);