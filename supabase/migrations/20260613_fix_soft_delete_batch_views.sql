-- Fix: exclude soft-deleted purchases from lot/batch availability views
-- When a purchase is soft-deleted (deleted_at IS NOT NULL), its items must
-- disappear from available lots immediately — before the 30-day hard-delete.
-- Affected: purchase_batch_availability, job_batch_availability,
--           recalculate_all_job_inventory.

-- ── 1. purchase_batch_availability ───────────────────────────────────────────
CREATE OR REPLACE VIEW public.purchase_batch_availability WITH (security_invoker = true) AS
SELECT
    pi.id as purchase_item_id,
    pi.item_id,
    pi.purchase_id as purchase_id,
    p.delivery_note_number as purchase_ref,
    p.delivery_note_date as purchase_date,
    pi.price as unit_price,
    pi.coefficient as coefficient,
    pi.quantity as original_quantity,

    LEAST(
        (CASE WHEN p.job_id IS NOT NULL THEN 0 ELSE pi.quantity END)
        - COALESCE((
            SELECT SUM(dni.quantity)
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = pi.id
            AND dn.type IN ('exit', 'sale')
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
        ), 0) + COALESCE((
            SELECT SUM(dni.quantity)
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = pi.id
            AND dn.type = 'entry'
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
        ), 0),
        pi.quantity
    ) as remaining_quantity,

    pi.pieces as original_pieces,

    LEAST(
        (CASE WHEN p.job_id IS NOT NULL THEN 0 ELSE pi.pieces END)
        - COALESCE((
            SELECT SUM(dni.pieces)
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = pi.id
            AND dn.type IN ('exit', 'sale')
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
        ), 0) + COALESCE((
            SELECT SUM(dni.pieces)
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = pi.id
            AND dn.type = 'entry'
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
        ), 0),
        pi.pieces
    ) as remaining_pieces

FROM public.purchase_items pi
JOIN public.purchases p ON pi.purchase_id = p.id
WHERE
    p.deleted_at IS NULL  -- exclude soft-deleted purchases

    AND (
        LEAST(
            (CASE WHEN p.job_id IS NOT NULL THEN 0 ELSE pi.quantity END)
            - COALESCE((SELECT SUM(dni.quantity) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type IN ('exit', 'sale') AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0)
            + COALESCE((SELECT SUM(dni.quantity) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type = 'entry' AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0),
            pi.quantity
        ) > 0.001

        OR LEAST(
            (CASE WHEN p.job_id IS NOT NULL THEN 0 ELSE pi.pieces END)
            - COALESCE((SELECT SUM(dni.pieces) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type IN ('exit', 'sale') AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0)
            + COALESCE((SELECT SUM(dni.pieces) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type = 'entry' AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0),
            pi.pieces
        ) > 0.001

        OR p.job_id IS NOT NULL
    );

GRANT SELECT ON public.purchase_batch_availability TO authenticated;

-- ── 2. job_batch_availability ─────────────────────────────────────────────────
DROP VIEW IF EXISTS job_batch_availability;

CREATE VIEW job_batch_availability AS
WITH direct_purchase_items AS (
    SELECT pi_1.id AS purchase_item_id
    FROM purchase_items pi_1
    JOIN purchases p_1 ON pi_1.purchase_id = p_1.id
    WHERE p_1.job_id IS NOT NULL
      AND p_1.deleted_at IS NULL  -- exclude soft-deleted
), warehouse_movements AS (
    SELECT dn.job_id,
        dni.inventory_id AS item_id,
        dni.purchase_item_id,
        CASE
            WHEN dn.type = 'exit'  THEN  dni.quantity
            WHEN dn.type = 'entry' THEN -dni.quantity
            ELSE 0
        END AS quantity,
        CASE
            WHEN dn.type = 'exit'  THEN  dni.pieces
            WHEN dn.type = 'entry' THEN -dni.pieces
            ELSE 0
        END AS pieces,
        dni.coefficient
    FROM delivery_note_items dni
    JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
    WHERE dn.job_id IS NOT NULL
      AND dn.type = ANY (ARRAY['exit'::text, 'entry'::text])
      AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
), direct_purchases AS (
    SELECT p_1.job_id,
        pi_1.item_id,
        pi_1.id AS purchase_item_id,
        pi_1.quantity,
        pi_1.pieces,
        pi_1.coefficient
    FROM purchase_items pi_1
    JOIN purchases p_1 ON pi_1.purchase_id = p_1.id
    WHERE p_1.job_id IS NOT NULL
      AND p_1.deleted_at IS NULL  -- exclude soft-deleted
)
SELECT combined.job_id,
    combined.item_id,
    combined.purchase_item_id,
    COALESCE(p.delivery_note_number, 'Acq. Diretto'::text) AS purchase_ref,
    p.delivery_note_date AS purchase_date,
    i.name AS item_name,
    i.model AS item_model,
    i.code AS item_code,
    i.unit AS item_unit,
    i.brand AS item_brand,
    i.category AS item_category,
    SUM(combined.quantity) AS quantity,
    SUM(combined.pieces) AS pieces,
    combined.coefficient,
    pi.quantity AS original_quantity,
    pi.pieces AS original_pieces
FROM (
    SELECT * FROM warehouse_movements
    UNION ALL
    SELECT * FROM direct_purchases
) combined
JOIN inventory i ON combined.item_id = i.id
LEFT JOIN purchase_items pi ON combined.purchase_item_id = pi.id
LEFT JOIN purchases p ON pi.purchase_id = p.id
GROUP BY combined.job_id, combined.item_id, combined.purchase_item_id,
         p.delivery_note_number, p.delivery_note_date,
         i.name, i.model, i.code, i.unit, i.brand, i.category,
         combined.coefficient, pi.quantity, pi.pieces
HAVING SUM(combined.quantity) > 0.001;

GRANT SELECT ON public.job_batch_availability TO authenticated;

-- ── 3. recalculate_all_job_inventory ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalculate_all_job_inventory()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.job_inventory;

    INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
    SELECT
        dn.job_id,
        dni.inventory_id,
        SUM(CASE
            WHEN dn.type = 'exit'  THEN  COALESCE(dni.pieces, 0)
            WHEN dn.type = 'entry' THEN -COALESCE(dni.pieces, 0)
            ELSE 0
        END) AS pieces,
        SUM(CASE
            WHEN dn.type = 'exit'  THEN  dni.quantity
            WHEN dn.type = 'entry' THEN -dni.quantity
            ELSE 0
        END) AS quantity
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
    WHERE dn.job_id IS NOT NULL
      AND dn.type IN ('entry', 'exit')
    GROUP BY dn.job_id, dni.inventory_id
    HAVING SUM(CASE
        WHEN dn.type = 'exit'  THEN  dni.quantity
        WHEN dn.type = 'entry' THEN -dni.quantity
        ELSE 0
    END) > 0;

    INSERT INTO public.job_inventory (job_id, item_id, pieces, quantity)
    SELECT
        p.job_id,
        pi.item_id,
        SUM(COALESCE(pi.pieces, 0)) AS pieces,
        SUM(pi.quantity)            AS quantity
    FROM public.purchase_items pi
    JOIN public.purchases p ON pi.purchase_id = p.id
    WHERE p.job_id IS NOT NULL
      AND p.deleted_at IS NULL  -- exclude soft-deleted
    GROUP BY p.job_id, pi.item_id
    ON CONFLICT (job_id, item_id)
    DO UPDATE SET
        pieces     = job_inventory.pieces   + EXCLUDED.pieces,
        quantity   = job_inventory.quantity + EXCLUDED.quantity,
        updated_at = now();
END;
$$;
