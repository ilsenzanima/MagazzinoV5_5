-- Versioni di analisi costi per le proposte: permette di salvare più analisi
-- costi alternative per la stessa proposta, e scegliere poi quale copiare
-- in commessa al momento della conversione.
CREATE TABLE proposal_cost_analysis_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id uuid NOT NULL REFERENCES client_proposals(id) ON DELETE CASCADE,
    name text NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE proposal_cost_analysis_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated all prop_cost_versions" ON proposal_cost_analysis_versions
    FOR ALL TO authenticated USING (( SELECT auth.uid() ) IS NOT NULL) WITH CHECK (( SELECT auth.uid() ) IS NOT NULL);

CREATE INDEX idx_proposal_cost_analysis_versions_proposal_id ON proposal_cost_analysis_versions(proposal_id);

-- Migra i dati esistenti (senza versione) in una versione "Versione 1" per proposta
INSERT INTO proposal_cost_analysis_versions (proposal_id, name)
SELECT DISTINCT proposal_id, 'Versione 1' FROM proposal_cost_analysis_rows
UNION
SELECT DISTINCT proposal_id, 'Versione 1' FROM proposal_cost_analysis_params
WHERE proposal_id NOT IN (SELECT proposal_id FROM proposal_cost_analysis_rows);

-- Collega le righe esistenti alla versione "Versione 1" creata sopra
ALTER TABLE proposal_cost_analysis_rows ADD COLUMN version_id uuid REFERENCES proposal_cost_analysis_versions(id) ON DELETE CASCADE;
UPDATE proposal_cost_analysis_rows r
SET version_id = v.id
FROM proposal_cost_analysis_versions v
WHERE v.proposal_id = r.proposal_id AND v.name = 'Versione 1';
ALTER TABLE proposal_cost_analysis_rows ALTER COLUMN version_id SET NOT NULL;
CREATE INDEX idx_proposal_cost_analysis_rows_version_id ON proposal_cost_analysis_rows(version_id);

-- Params: passa da PK(proposal_id) a PK(version_id), una riga di parametri per versione
ALTER TABLE proposal_cost_analysis_params ADD COLUMN version_id uuid REFERENCES proposal_cost_analysis_versions(id) ON DELETE CASCADE;
UPDATE proposal_cost_analysis_params p
SET version_id = v.id
FROM proposal_cost_analysis_versions v
WHERE v.proposal_id = p.proposal_id AND v.name = 'Versione 1';
ALTER TABLE proposal_cost_analysis_params DROP CONSTRAINT proposal_cost_analysis_params_pkey;
ALTER TABLE proposal_cost_analysis_params ALTER COLUMN version_id SET NOT NULL;
ALTER TABLE proposal_cost_analysis_params ADD PRIMARY KEY (version_id);

-- Traccia da quale versione di analisi costi della proposta deriva l'analisi costi
-- della commessa, per poter cambiare in seguito quale versione è stata usata.
ALTER TABLE job_cost_analysis_params ADD COLUMN source_proposal_version_id uuid REFERENCES proposal_cost_analysis_versions(id) ON DELETE SET NULL;
