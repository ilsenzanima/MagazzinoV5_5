-- Documenti della nota di credito (reso al fornitore) tenuti separati dai
-- documenti della fattura, sulla stessa fattura a cui la nota di credito
-- si riferisce.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS credit_note_document_urls text[] NOT NULL DEFAULT '{}'::text[];
