-- RESET DATA SCRIPT
-- Deletes all transactional data to reset the system.

BEGIN;

-- Delete items first (should cascade from headers, but being explicit is safer)
DELETE FROM public.delivery_note_items;
DELETE FROM public.purchase_items;

-- Delete headers
DELETE FROM public.delivery_notes;
DELETE FROM public.purchases;

-- Delete legacy movements if any
DELETE FROM public.movements;

-- Clear job inventory
TRUNCATE TABLE public.job_inventory CASCADE;

-- Reset main inventory quantities and pieces to 0
UPDATE public.inventory SET quantity = 0, pieces = 0;

COMMIT;
