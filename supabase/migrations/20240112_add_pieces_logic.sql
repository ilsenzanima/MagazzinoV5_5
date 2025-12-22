-- Add pieces and coefficient columns to purchase_items and delivery_note_items
-- This allows tracking the original input (pieces) and the conversion factor used at the time

-- 1. Purchase Items
ALTER TABLE public.purchase_items
ADD COLUMN IF NOT EXISTS pieces NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS coefficient NUMERIC(10, 2) DEFAULT 1.0;

-- 2. Delivery Note Items
ALTER TABLE public.delivery_note_items
ADD COLUMN IF NOT EXISTS pieces NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS coefficient NUMERIC(10, 2) DEFAULT 1.0;
