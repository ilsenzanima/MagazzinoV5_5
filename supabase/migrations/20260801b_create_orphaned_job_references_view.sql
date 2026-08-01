-- Vista per la pagina admin "Anomalie": acquisti o bolle che puntano a una
-- commessa che è stata spostata nel cestino (soft-delete). Riferimenti "orfani"
-- che possono generare problemi analoghi a quelli già visti per i lotti
-- incrociati tra commesse (vedi negative_lot_movements).
CREATE OR REPLACE VIEW public.orphaned_job_references AS
SELECT
    'purchase'::text AS source_type,
    p.id AS source_id,
    p.delivery_note_number AS reference,
    p.delivery_note_date AS reference_date,
    j.id AS job_id,
    j.code AS job_code
FROM public.purchases p
JOIN public.jobs j ON j.id = p.job_id
WHERE j.deleted_at IS NOT NULL AND p.deleted_at IS NULL

UNION ALL

SELECT
    'delivery_note'::text AS source_type,
    dn.id AS source_id,
    dn.number AS reference,
    dn.date AS reference_date,
    j.id AS job_id,
    j.code AS job_code
FROM public.delivery_notes dn
JOIN public.jobs j ON j.id = dn.job_id
WHERE j.deleted_at IS NOT NULL;

GRANT SELECT ON public.orphaned_job_references TO anon, authenticated;
