-- Add transport_time to delivery_notes table
ALTER TABLE public.delivery_notes 
ADD COLUMN IF NOT EXISTS transport_time TIME;
