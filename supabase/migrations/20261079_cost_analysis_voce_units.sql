-- Unità di misura opzionali per le voci non di magazzino dell'analisi costi (generiche, trasporto, posa).
-- Elenco modificabile da Impostazioni → Elenchi. «name» è ciò che compare sul prezzo (es. €/ora),
-- «qty_label» ciò che compare sulla quantità (es. ore); se vuoto si usa il nome.
create table if not exists public.cost_analysis_voce_units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  qty_label text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.cost_analysis_voce_units enable row level security;

create policy "Authenticated users can select cost analysis voce units" on public.cost_analysis_voce_units
  for select to authenticated using (true);
create policy "Authenticated users can insert cost analysis voce units" on public.cost_analysis_voce_units
  for insert to authenticated with check (get_my_role() = any (array['admin'::text, 'operativo'::text]));
create policy "Authenticated users can update cost analysis voce units" on public.cost_analysis_voce_units
  for update to authenticated using (get_my_role() = any (array['admin'::text, 'operativo'::text]));
create policy "Authenticated users can delete cost analysis voce units" on public.cost_analysis_voce_units
  for delete to authenticated using (get_my_role() = any (array['admin'::text, 'operativo'::text]));

insert into public.cost_analysis_voce_units (name, qty_label, sort_order) values
  ('ora', 'ore', 1),
  ('giorno', 'giorni', 2),
  ('mese', 'mesi', 3),
  ('pz', 'pz', 4),
  ('m', 'm', 5),
  ('ml', 'ml', 6),
  ('m²', 'm²', 7),
  ('kg', 'kg', 8)
on conflict (name) do nothing;
