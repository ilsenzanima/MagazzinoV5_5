-- Migration: Aggiunta campo client_id alla tabella delivery_notes
-- Date: 2026-07-07

ALTER TABLE public.delivery_notes 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
