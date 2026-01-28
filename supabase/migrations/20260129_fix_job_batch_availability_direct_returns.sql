-- Migration: Fix job_batch_availability to include movements (returns) for direct purchase items
-- Date: 2026-01-29
-- Description: Removes the filter that excluded movements for direct purchase items, allowing returns to be correctly subtracted from job inventory.

DROP VIEW IF EXISTS job_batch_availability;

CREATE VIEW job_batch_availability AS
WITH direct_purchase_items AS (
    SELECT pi_1.id AS purchase_item_id
    FROM (purchase_items pi_1
        JOIN purchases p_1 ON ((pi_1.purchase_id = p_1.id)))
    WHERE (p_1.job_id IS NOT NULL)
), warehouse_movements AS (
    SELECT dn.job_id,
        dni.inventory_id AS item_id,
        dni.purchase_item_id,
        CASE
            WHEN (dn.type = 'exit'::text) THEN dni.quantity
            WHEN (dn.type = 'entry'::text) THEN (- dni.quantity)
            ELSE (0)::numeric
        END AS quantity,
        CASE
            WHEN (dn.type = 'exit'::text) THEN dni.pieces
            WHEN (dn.type = 'entry'::text) THEN (- dni.pieces)
            ELSE (0)::numeric
        END AS pieces,
        dni.coefficient
    FROM (delivery_note_items dni
        JOIN delivery_notes dn ON ((dni.delivery_note_id = dn.id)))
    WHERE ((dn.job_id IS NOT NULL) 
      AND (dn.type = ANY (ARRAY['exit'::text, 'entry'::text])) 
      AND ((dni.is_fictitious IS FALSE) OR (dni.is_fictitious IS NULL))
      -- REMOVED: Exclusion of direct purchase items. We WANT to see returns for these items.
    )
), direct_purchases AS (
    SELECT p_1.job_id,
        pi_1.item_id,
        pi_1.id AS purchase_item_id,
        pi_1.quantity,
        pi_1.pieces,
        pi_1.coefficient
    FROM (purchase_items pi_1
        JOIN purchases p_1 ON ((pi_1.purchase_id = p_1.id)))
    WHERE (p_1.job_id IS NOT NULL)
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
    sum(combined.quantity) AS quantity,
    sum(combined.pieces) AS pieces,
    combined.coefficient,
    pi.quantity AS original_quantity,
    pi.pieces AS original_pieces
FROM (((( SELECT warehouse_movements.job_id,
        warehouse_movements.item_id,
        warehouse_movements.purchase_item_id,
        warehouse_movements.quantity,
        warehouse_movements.pieces,
        warehouse_movements.coefficient
        FROM warehouse_movements
    UNION ALL
        SELECT direct_purchases.job_id,
        direct_purchases.item_id,
        direct_purchases.purchase_item_id,
        direct_purchases.quantity,
        direct_purchases.pieces,
        direct_purchases.coefficient
        FROM direct_purchases) combined
    JOIN inventory i ON ((combined.item_id = i.id)))
    LEFT JOIN purchase_items pi ON ((combined.purchase_item_id = pi.id)))
    LEFT JOIN purchases p ON ((pi.purchase_id = p.id)))
GROUP BY combined.job_id, combined.item_id, combined.purchase_item_id, p.delivery_note_number, p.delivery_note_date, i.name, i.model, i.code, i.unit, i.brand, i.category, combined.coefficient, pi.quantity, pi.pieces
HAVING (sum(combined.quantity) > 0.001);
