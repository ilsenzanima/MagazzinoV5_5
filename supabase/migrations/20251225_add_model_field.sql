-- Add 'model' column to inventory table to distinguish variants of the same item
-- Example: Name="Tube", Model="10mm"

ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS model TEXT;
