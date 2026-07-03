-- BUG CRITICO: shared_documents, shared_site_documents, shared_supplier_offers e
-- shared_compliance_associations condividono la STESSA riga tra proposta e commessa
-- (job_id viene impostato sulla riga esistente della proposta al momento della
-- conversione, senza copiarla). Le FK job_id/proposal_id di queste tabelle erano
-- ON DELETE CASCADE: eliminare definitivamente una commessa dal Cestino cancellava
-- quindi anche i documenti ancora visibili sull'offerta di origine (e viceversa),
-- perché la riga condivisa veniva eliminata insieme all'entità cancellata.
--
-- Passa a ON DELETE SET NULL: quando job o proposta vengono eliminati definitivamente,
-- la riga condivisa sopravvive (con l'altro lato ancora valorizzato) finché il relativo
-- owner_check (proposal_id IS NOT NULL OR job_id IS NOT NULL) resta soddisfatto.

-- shared_documents ("Documenti Offerte" / "Documenti Commessa")
ALTER TABLE shared_documents DROP CONSTRAINT shared_documents_job_id_fkey;
ALTER TABLE shared_documents ADD CONSTRAINT shared_documents_job_id_fkey
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE shared_documents DROP CONSTRAINT proposal_documents_proposal_id_fkey;
ALTER TABLE shared_documents ADD CONSTRAINT proposal_documents_proposal_id_fkey
    FOREIGN KEY (proposal_id) REFERENCES client_proposals(id) ON DELETE SET NULL;

-- shared_site_documents ("Documenti Cantiere")
ALTER TABLE shared_site_documents DROP CONSTRAINT shared_site_documents_job_id_fkey;
ALTER TABLE shared_site_documents ADD CONSTRAINT shared_site_documents_job_id_fkey
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE shared_site_documents DROP CONSTRAINT shared_site_documents_proposal_id_fkey;
ALTER TABLE shared_site_documents ADD CONSTRAINT shared_site_documents_proposal_id_fkey
    FOREIGN KEY (proposal_id) REFERENCES client_proposals(id) ON DELETE SET NULL;

-- shared_supplier_offers ("Offerte Fornitori")
ALTER TABLE shared_supplier_offers DROP CONSTRAINT shared_supplier_offers_job_id_fkey;
ALTER TABLE shared_supplier_offers ADD CONSTRAINT shared_supplier_offers_job_id_fkey
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE shared_supplier_offers DROP CONSTRAINT shared_supplier_offers_proposal_id_fkey;
ALTER TABLE shared_supplier_offers ADD CONSTRAINT shared_supplier_offers_proposal_id_fkey
    FOREIGN KEY (proposal_id) REFERENCES client_proposals(id) ON DELETE SET NULL;

-- shared_compliance_associations (associazioni conformità)
ALTER TABLE shared_compliance_associations DROP CONSTRAINT shared_compliance_associations_job_id_fkey;
ALTER TABLE shared_compliance_associations ADD CONSTRAINT shared_compliance_associations_job_id_fkey
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE shared_compliance_associations DROP CONSTRAINT shared_compliance_associations_proposal_id_fkey;
ALTER TABLE shared_compliance_associations ADD CONSTRAINT shared_compliance_associations_proposal_id_fkey
    FOREIGN KEY (proposal_id) REFERENCES client_proposals(id) ON DELETE SET NULL;
