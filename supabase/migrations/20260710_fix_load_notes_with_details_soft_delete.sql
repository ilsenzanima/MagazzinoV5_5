-- Fix: load_notes_with_details showed soft-deleted notes both in the main
-- list and in the trash, because the view had no filter on deleted_at.

DROP VIEW IF EXISTS public.load_notes_with_details;

CREATE VIEW public.load_notes_with_details WITH (security_invoker = true) AS
SELECT
    ln.id,
    ln.date,
    ln.note_type,
    ln.job_id,
    ln.notes,
    ln.status,
    ln.created_by,
    ln.created_at,
    ln.updated_at,
    j.code AS job_code,
    j.name AS job_description,
    p.full_name AS created_by_name,
    (
        SELECT COUNT(*)
        FROM load_note_items lni
        WHERE lni.load_note_id = ln.id
    ) AS items_count
FROM load_notes ln
LEFT JOIN jobs j ON ln.job_id = j.id
LEFT JOIN profiles p ON ln.created_by = p.id
WHERE ln.deleted_at IS NULL;

GRANT SELECT ON public.load_notes_with_details TO authenticated;

COMMENT ON VIEW public.load_notes_with_details IS 'Load notes with job and creator details (excludes soft-deleted notes)';
