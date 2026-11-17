-- Attrezzature: pezzi disponibili, segnati a mano (gli acquistati si calcolano dagli acquisti)
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS available_count numeric;
