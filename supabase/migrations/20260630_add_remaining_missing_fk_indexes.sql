-- Aggiunge gli indici mancanti sulle foreign key segnalate dall'advisor performance di Supabase
CREATE INDEX IF NOT EXISTS idx_client_proposals_deleted_by ON public.client_proposals(deleted_by);
CREATE INDEX IF NOT EXISTS idx_job_compliance_associations_compliance_document_id ON public.job_compliance_associations(compliance_document_id);
CREATE INDEX IF NOT EXISTS idx_job_compliance_associations_created_by ON public.job_compliance_associations(created_by);
CREATE INDEX IF NOT EXISTS idx_proposal_compliance_associations_compliance_document_id ON public.proposal_compliance_associations(compliance_document_id);
CREATE INDEX IF NOT EXISTS idx_proposal_compliance_associations_created_by ON public.proposal_compliance_associations(created_by);
CREATE INDEX IF NOT EXISTS idx_supplier_compliance_documents_created_by ON public.supplier_compliance_documents(created_by);
CREATE INDEX IF NOT EXISTS idx_supplier_compliance_documents_deleted_by ON public.supplier_compliance_documents(deleted_by);
CREATE INDEX IF NOT EXISTS idx_supplier_groups_deleted_by ON public.supplier_groups(deleted_by);
