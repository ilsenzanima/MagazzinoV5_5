-- Migration: Create job_fictitious_batch_availability view
-- Date: 2026-05-22
-- Description: Exposes the net fictitious quantity at a job site per (job, item, purchase_batch).
--              Used in the reso picker to show fictitious items alongside real ones,
--              so the user can create a return for items loaded as fictitious.
--              Only rows where fictitious exits > fictitious entries are returned (HAVING > 0).

CREATE VIEW public.job_fictitious_batch_availability WITH (security_invoker = true) AS
SELECT
    dn.job_id,
    dni.inventory_id AS item_id,
    dni.purchase_item_id,
    NULL::text AS purchase_ref,
    NULL::date AS purchase_date,
    i.name AS item_name,
    i.model AS item_model,
    i.code AS item_code,
    i.unit AS item_unit,
    i.brand AS item_brand,
    i.category AS item_category,
    SUM(
        CASE
            WHEN (dn.type = 'exit'::text) THEN dni.quantity
            WHEN (dn.type = 'entry'::text) THEN (- dni.quantity)
            ELSE (0)::numeric
        END
    ) AS quantity,
    SUM(
        CASE
            WHEN (dn.type = 'exit'::text) THEN COALESCE(dni.pieces, (0)::numeric)
            WHEN (dn.type = 'entry'::text) THEN (- COALESCE(dni.pieces, (0)::numeric))
            ELSE (0)::numeric
        END
    ) AS pieces,
    MAX(dni.coefficient) AS coefficient,
    NULL::numeric AS original_quantity,
    NULL::numeric AS original_pieces
FROM (delivery_note_items dni
    JOIN delivery_notes dn ON ((dni.delivery_note_id = dn.id)))
    JOIN inventory i ON ((dni.inventory_id = i.id))
WHERE ((dn.job_id IS NOT NULL)
  AND (dn.type = ANY (ARRAY['exit'::text, 'entry'::text]))
  AND (dni.is_fictitious IS TRUE))
GROUP BY dn.job_id, dni.inventory_id, dni.purchase_item_id,
    i.name, i.model, i.code, i.unit, i.brand, i.category
HAVING (SUM(
    CASE
        WHEN (dn.type = 'exit'::text) THEN dni.quantity
        WHEN (dn.type = 'entry'::text) THEN (- dni.quantity)
        ELSE (0)::numeric
    END
) > (0.001)::numeric);

GRANT SELECT ON public.job_fictitious_batch_availability TO authenticated;
