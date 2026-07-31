-- One-off data correction for SIL-PRO-098 (Promaseal-AG), same root cause already
-- fixed for its sibling SIL-PRO-097 in 20260719c_reassign_sil_pro_097_lot_movement.sql.
--
-- delivery_note_item 1840786b-d612-44ff-a6e9-cf308406d6f4 (bolla 114/PP26, 2026-07-07,
-- job "2026-06-CON", exit of 8 pz) was linked via purchase_item_id to purchase_item
-- 7c070f23 (48 pz, bought 2025-11-12 directly for job "2026-01-CXX"). Job-direct
-- purchases never enter the general warehouse lots, so that lot is treated as fully
-- consumed on day one; this exit for an unrelated job drove it to -8 remaining, and
-- since remainingQty is clamped/displayed as exhausted, editing this bolla (to add an
-- unrelated missing item) got blocked by that lot showing as esaurito.
--
-- Fix: relink to purchase_item 77285db1 (432 pz, 2025-12-03, also job "2026-01-CXX"),
-- which has genuine surplus (286 remaining) before and after this bolla's date. This
-- only changes lot traceability (purchase_item_id) -- no quantity, pieces,
-- job_inventory, or inventory totals are affected.
--
-- Applied and verified directly on the Supabase project "Magazzino" before being
-- committed: purchase_batch_availability now has zero rows with negative remaining
-- quantity/pieces (was 1 before this fix).

UPDATE public.delivery_note_items
SET purchase_item_id = '77285db1-52d5-4e1f-8263-4f2d25ea0192'
WHERE id = '1840786b-d612-44ff-a6e9-cf308406d6f4'
  AND purchase_item_id = '7c070f23-4775-4cd9-8cf2-70efb7807301';
