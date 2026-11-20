-- Analisi costi dell'offerta: nuova sezione «Trasporto e posa».
-- Le voci di trasporto e di posa sono righe della stessa tabella con type 'transport' / 'posa';
-- la loro somma alimenta i parametri Trasporto (A) e Posa (B) del riepilogo prezzi.
ALTER TABLE public.proposal_cost_analysis_rows DROP CONSTRAINT IF EXISTS proposal_cost_analysis_rows_type_check;
ALTER TABLE public.proposal_cost_analysis_rows
    ADD CONSTRAINT proposal_cost_analysis_rows_type_check
    CHECK (type = ANY (ARRAY['inventory'::text, 'generic'::text, 'transport'::text, 'posa'::text]));
