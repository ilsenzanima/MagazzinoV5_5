create table compliance_document_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table compliance_document_types enable row level security;
create policy "Allow authenticated select" on compliance_document_types for select to authenticated using (true);
create policy "Allow authenticated insert" on compliance_document_types for insert to authenticated with check (true);
create policy "Allow authenticated update" on compliance_document_types for update to authenticated using (true);
create policy "Allow authenticated delete" on compliance_document_types for delete to authenticated using (true);

insert into compliance_document_types (name) values
  ('RDC/RDV/FT'),
  ('ETA'),
  ('DOP'),
  ('Conformità Produttore'),
  ('Omologazione Ministeriale');

alter table supplier_compliance_documents add column document_type_id uuid references compliance_document_types(id) on delete set null;
alter table supplier_compliance_documents alter column document_type drop not null;
alter table supplier_compliance_documents alter column document_type set default '';

update supplier_compliance_documents s set document_type_id = t.id
from compliance_document_types t
where (s.document_type = 'RDC_RDV_FT' and t.name = 'RDC/RDV/FT')
   or (s.document_type = 'ETA' and t.name = 'ETA')
   or (s.document_type = 'DOP' and t.name = 'DOP')
   or (s.document_type = 'CONFORMITA_PRODUTTORE' and t.name = 'Conformità Produttore')
   or (s.document_type = 'OMOLOGAZIONE_MINISTERIALE' and t.name = 'Omologazione Ministeriale');

create index idx_supplier_compliance_documents_type on supplier_compliance_documents(document_type_id);
