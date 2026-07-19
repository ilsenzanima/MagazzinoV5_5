-- One-time backfill of job_inventory.quantity/pieces from full history, fixing:
-- 1. 12 missing job+item rows (direct-to-job purchases never created a row --
--    now fixed going forward by the handle_purchase_item_change() rewrite).
-- 2. 387 stale `pieces` values (pre-fix handle_movement_logic only updated quantity).
-- 3. 7 stale `quantity` values, each individually verified against source records
--    before applying (see conversation) -- all explained by the same direct-to-job
--    purchase gap or simple drift, no lot-attribution ambiguity like SIL-PRO-097.
--
-- Formula mirrors exactly what the now-fixed triggers produce: purchase_items
-- assigned to the job (excluding trashed purchases and pending orders) plus the
-- net of delivery_note_items (exit adds, entry/return subtracts) for that job.
-- Verified via dry-run: no negative results.

WITH job_purchased AS (
  SELECT p.job_id, pi.item_id, SUM(pi.quantity) AS qty, SUM(COALESCE(pi.pieces,0)) AS pcs
  FROM purchase_items pi JOIN purchases p ON pi.purchase_id = p.id
  WHERE p.job_id IS NOT NULL AND p.deleted_at IS NULL AND (p.order_type IS NULL OR p.order_type = 'purchase')
  GROUP BY p.job_id, pi.item_id
),
job_delivered AS (
  SELECT dn.job_id, dni.inventory_id AS item_id,
    SUM(CASE WHEN dn.type='exit' THEN dni.quantity WHEN dn.type='entry' THEN -dni.quantity ELSE 0 END) AS qty,
    SUM(CASE WHEN dn.type='exit' THEN COALESCE(dni.pieces,0) WHEN dn.type='entry' THEN -COALESCE(dni.pieces,0) ELSE 0 END) AS pcs
  FROM delivery_note_items dni JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
  WHERE dn.job_id IS NOT NULL AND dn.type IN ('entry','exit')
  GROUP BY dn.job_id, dni.inventory_id
),
correct AS (
  SELECT COALESCE(jp.job_id, jd.job_id) AS job_id, COALESCE(jp.item_id, jd.item_id) AS item_id,
    COALESCE(jp.qty,0) + COALESCE(jd.qty,0) AS correct_qty,
    COALESCE(jp.pcs,0) + COALESCE(jd.pcs,0) AS correct_pcs
  FROM job_purchased jp FULL OUTER JOIN job_delivered jd ON jd.job_id = jp.job_id AND jd.item_id = jp.item_id
)
INSERT INTO public.job_inventory (job_id, item_id, quantity, pieces)
SELECT job_id, item_id, correct_qty, correct_pcs
FROM correct
WHERE ABS(correct_qty) > 0.01 OR ABS(correct_pcs) > 0.01
ON CONFLICT (job_id, item_id) DO UPDATE SET
  quantity = EXCLUDED.quantity,
  pieces = EXCLUDED.pieces,
  updated_at = now();

-- Edge case the formula above skips: rows already at quantity=0 (correct) but with
-- a stale nonzero `pieces` left over -- zero those out too.
UPDATE public.job_inventory
SET pieces = 0, updated_at = now()
WHERE ABS(quantity) <= 0.01 AND ABS(COALESCE(pieces, 0)) > 0.01;
