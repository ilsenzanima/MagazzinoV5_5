-- One-off data correction for SIL-PRO-097 (Promaseal-A).
--
-- The item's "Storico Lotti" view showed two available lots (9 + 70 = 79) against
-- a true total quantity of 72. Root cause: purchase_item 16303373 (132 pz, bought
-- 2025-11-12 directly for job "CX-Place") is treated by getLotsForItem() as fully
-- consumed on day one (job-direct purchases never enter the general warehouse).
-- Two later delivery_note_items -- an exit of 8 (bolla 114/PP26, 2026-07-07) and a
-- return of 1 (bolla 115/PP26, 2026-07-08) -- both for a *different* job
-- ("Condomino WALLY"), were linked via purchase_item_id to this same lot 16303373,
-- presumably because it was the oldest purchase_item by date. This drew the lot
-- 7 units past its own 132, and since remainingQty is clamped to >= 0 per lot, that
-- -7 shortfall silently disappeared instead of offsetting the surplus on other lots.
--
-- Fix: relink those two rows to purchase_item cc514076 (600 pz, 2026-01-12, also
-- CX-Place), which had genuine surplus (returns from that job) on those dates.
-- This only changes lot traceability (purchase_item_id) -- no quantity, pieces,
-- job_inventory, or inventory totals are affected. Verified afterwards: lots sum
-- to exactly 72, matching inventory.quantity, with no clamped negative remainder.

UPDATE public.delivery_note_items
SET purchase_item_id = 'cc514076-1847-403a-93b9-b5f62c531d24'
WHERE id IN ('bd9ec1f7-df04-4db1-b848-ac99ec768948', 'aec231d8-2bae-4393-bdcf-f465ba6ada0b')
  AND purchase_item_id = '16303373-eb43-4a3f-bbe8-d2c0ea10b9b5';
