-- Analisi costi per commesse create senza offerta.
--
-- Una versione di analisi costi può appartenere a UN'offerta (proposal_id)
-- OPPURE a UNA commessa (job_id). Le righe e i parametri restano agganciati
-- alla versione (version_id), quindi non cambia nulla per il calcolo e gli export.
--
-- MIGRAZIONE SOLO ADDITIVA: nessun DROP, UPDATE o DELETE sui dati esistenti.
-- Tutte le versioni/righe/parametri attuali hanno già proposal_id valorizzato
-- e restano invariati (soddisfano già il nuovo vincolo).

-- 1. Le versioni possono appartenere a una commessa.
ALTER TABLE public.proposal_cost_analysis_versions
    ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE;

-- 2. proposal_id non è più obbligatorio (è un rilassamento: non tocca i dati).
ALTER TABLE public.proposal_cost_analysis_versions ALTER COLUMN proposal_id DROP NOT NULL;
ALTER TABLE public.proposal_cost_analysis_rows     ALTER COLUMN proposal_id DROP NOT NULL;
ALTER TABLE public.proposal_cost_analysis_params   ALTER COLUMN proposal_id DROP NOT NULL;

-- 3. Una versione ha esattamente un proprietario: o l'offerta o la commessa.
ALTER TABLE public.proposal_cost_analysis_versions
    ADD CONSTRAINT proposal_cost_analysis_versions_owner_check
    CHECK (num_nonnulls(proposal_id, job_id) = 1);

-- 4. Indice sulla nuova chiave esterna.
CREATE INDEX IF NOT EXISTS idx_proposal_cost_analysis_versions_job_id
    ON public.proposal_cost_analysis_versions(job_id);
