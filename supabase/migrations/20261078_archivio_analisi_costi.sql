-- Archivio analisi costi: modelli riutilizzabili e voci di trasporto/posa anche in commessa.
--
-- MIGRAZIONE SOLO ADDITIVA: nessun dato esistente viene modificato.
--  * Un «modello» è una versione di analisi costi senza offerta né commessa (is_template = true),
--    riusabile come base per nuove analisi. source_version_id ricorda da quale analisi/modello deriva.
--  * Le righe della commessa possono essere anche di tipo 'transport' e 'posa'
--    (per conservare il dettaglio delle voci quando l'offerta diventa commessa).

ALTER TABLE public.proposal_cost_analysis_versions
    ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS source_version_id uuid REFERENCES public.proposal_cost_analysis_versions(id) ON DELETE SET NULL;

-- Un'analisi ha un proprietario (offerta o commessa); un modello non ne ha nessuno.
ALTER TABLE public.proposal_cost_analysis_versions DROP CONSTRAINT IF EXISTS proposal_cost_analysis_versions_owner_check;
ALTER TABLE public.proposal_cost_analysis_versions
    ADD CONSTRAINT proposal_cost_analysis_versions_owner_check
    CHECK (
        (is_template AND num_nonnulls(proposal_id, job_id) = 0)
        OR (NOT is_template AND num_nonnulls(proposal_id, job_id) = 1)
    );

CREATE INDEX IF NOT EXISTS idx_proposal_cost_analysis_versions_template
    ON public.proposal_cost_analysis_versions(is_template) WHERE is_template;

ALTER TABLE public.job_cost_analysis_rows DROP CONSTRAINT IF EXISTS job_cost_analysis_rows_type_check;
ALTER TABLE public.job_cost_analysis_rows
    ADD CONSTRAINT job_cost_analysis_rows_type_check
    CHECK (type = ANY (ARRAY['inventory'::text, 'generic'::text, 'transport'::text, 'posa'::text]));
