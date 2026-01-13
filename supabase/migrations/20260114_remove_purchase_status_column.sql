-- Remove the legacy status column from purchases table
-- Status will now be computed dynamically based on:
-- - "OK" = all items have prices and pieces available
-- - "Prezzi mancanti" = some items have price = 0
-- - "Pezzi esauriti" = some items have remainingPieces <= 0

ALTER TABLE public.purchases DROP COLUMN IF EXISTS status;
