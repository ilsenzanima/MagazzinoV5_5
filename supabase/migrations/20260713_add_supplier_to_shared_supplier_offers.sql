-- Aggiunge il fornitore associato a ogni offerta caricata, per poterle
-- raggruppare in sotto-tab per fornitore nella UI.
ALTER TABLE shared_supplier_offers ADD COLUMN supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX idx_shared_supplier_offers_supplier_id ON shared_supplier_offers(supplier_id);
