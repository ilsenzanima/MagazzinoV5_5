-- Bozze di movimentazione: stessa testata di una bolla, righe salvate come istantanea (jsonb).
-- Non toccano giacenze, lotti o viste: le righe diventano vere solo quando la bozza viene confermata.
-- Per annullare: drop table public.delivery_note_drafts;
create table if not exists public.delivery_note_drafts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('entry','exit','sale','waste','transfer')),
  number text not null,
  number_int integer generated always as ((substring(number from '^(\d+)'))::integer) stored,
  date date not null,
  job_id uuid references public.jobs(id) on delete set null,
  causal text,
  pickup_location text,
  delivery_location text,
  from_warehouse_id uuid references public.warehouses(id) on delete set null,
  to_warehouse_id uuid references public.warehouses(id) on delete set null,
  transport_mean text,
  transport_time text,
  appearance text,
  packages_count integer,
  notes text,
  items jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.delivery_note_drafts enable row level security;

create policy "Drafts viewable by admin/operativo" on public.delivery_note_drafts
  for select using (get_my_role() = any (array['admin','operativo']));
create policy "Drafts insertable by admin/operativo" on public.delivery_note_drafts
  for insert with check (get_my_role() = any (array['admin','operativo']));
create policy "Drafts updatable by admin/operativo" on public.delivery_note_drafts
  for update using (get_my_role() = any (array['admin','operativo']));
create policy "Drafts deletable by admin/operativo" on public.delivery_note_drafts
  for delete using (get_my_role() = any (array['admin','operativo']));
