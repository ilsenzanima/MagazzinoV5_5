-- Sottocartelle per "Documenti Cantiere" e "Documenti Offerte", sul modello di
-- job_document_folders già usato per la Conformità Cantiere: un tipo documento con
-- allows_folders=true può avere cartelle, e ogni documento può appartenere a una di esse.
-- A differenza della Conformità (solo commessa), qui i tipi documento sono condivisi tra
-- commesse e proposte (shared_site_documents/shared_documents hanno sia job_id che
-- proposal_id), quindi anche le cartelle possono appartenere all'una o all'altra.

ALTER TABLE job_site_document_types ADD COLUMN allows_folders boolean NOT NULL DEFAULT false;
ALTER TABLE proposal_document_types ADD COLUMN allows_folders boolean NOT NULL DEFAULT false;

-- Documenti Cantiere
CREATE TABLE job_site_document_folders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
    proposal_id uuid REFERENCES client_proposals(id) ON DELETE CASCADE,
    document_type_id uuid NOT NULL REFERENCES job_site_document_types(id) ON DELETE CASCADE,
    name text NOT NULL,
    drive_folder_id text,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT job_site_document_folders_owner_check CHECK (
        (job_id IS NOT NULL AND proposal_id IS NULL) OR (job_id IS NULL AND proposal_id IS NOT NULL)
    )
);

CREATE INDEX idx_job_site_document_folders_job_id ON job_site_document_folders(job_id);
CREATE INDEX idx_job_site_document_folders_proposal_id ON job_site_document_folders(proposal_id);
CREATE INDEX idx_job_site_document_folders_document_type_id ON job_site_document_folders(document_type_id);

ALTER TABLE job_site_document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read job_site_document_folders"
    ON job_site_document_folders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert job_site_document_folders"
    ON job_site_document_folders FOR INSERT TO authenticated
    WITH CHECK (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));
CREATE POLICY "Authenticated users can update job_site_document_folders"
    ON job_site_document_folders FOR UPDATE TO authenticated
    USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));
CREATE POLICY "Authenticated users can delete job_site_document_folders"
    ON job_site_document_folders FOR DELETE TO authenticated
    USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));

ALTER TABLE shared_site_documents ADD COLUMN folder_id uuid REFERENCES job_site_document_folders(id) ON DELETE SET NULL;
CREATE INDEX idx_shared_site_documents_folder_id ON shared_site_documents(folder_id);

-- Documenti Offerte
CREATE TABLE proposal_document_folders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
    proposal_id uuid REFERENCES client_proposals(id) ON DELETE CASCADE,
    document_type_id uuid NOT NULL REFERENCES proposal_document_types(id) ON DELETE CASCADE,
    name text NOT NULL,
    drive_folder_id text,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT proposal_document_folders_owner_check CHECK (
        (job_id IS NOT NULL AND proposal_id IS NULL) OR (job_id IS NULL AND proposal_id IS NOT NULL)
    )
);

CREATE INDEX idx_proposal_document_folders_job_id ON proposal_document_folders(job_id);
CREATE INDEX idx_proposal_document_folders_proposal_id ON proposal_document_folders(proposal_id);
CREATE INDEX idx_proposal_document_folders_document_type_id ON proposal_document_folders(document_type_id);

ALTER TABLE proposal_document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read proposal_document_folders"
    ON proposal_document_folders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert proposal_document_folders"
    ON proposal_document_folders FOR INSERT TO authenticated
    WITH CHECK (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));
CREATE POLICY "Authenticated users can update proposal_document_folders"
    ON proposal_document_folders FOR UPDATE TO authenticated
    USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));
CREATE POLICY "Authenticated users can delete proposal_document_folders"
    ON proposal_document_folders FOR DELETE TO authenticated
    USING (get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text]));

ALTER TABLE shared_documents ADD COLUMN folder_id uuid REFERENCES proposal_document_folders(id) ON DELETE SET NULL;
CREATE INDEX idx_shared_documents_folder_id ON shared_documents(folder_id);
