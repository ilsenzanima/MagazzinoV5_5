-- The legacy `document_type` column was superseded by `document_type_id` (FK to
-- compliance_document_types) and made nullable with a '' default, but the original
-- CHECK constraint restricting it to a fixed enum list was never dropped. Since ''
-- is not one of the allowed values, every insert that relies on the default (i.e.
-- every insert from the current app, which only sets document_type_id) violates the
-- constraint and fails with a 400 error.
do $$
declare
    c record;
begin
    for c in
        select con.conname
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        where rel.relname = 'supplier_compliance_documents'
          and con.contype = 'c'
          and pg_get_constraintdef(con.oid) ilike '%document_type%'
    loop
        execute format('alter table supplier_compliance_documents drop constraint %I', c.conname);
    end loop;
end $$;

alter table supplier_compliance_documents alter column document_type drop default;
alter table supplier_compliance_documents alter column document_type set default null;
