-- Migration: Add Performance Indexes
-- Data: 2025-12-29
-- Descrizione: Aggiunge indici su colonne frequentemente filtrate per migliorare performance

-- =====================================================
-- INDICI TABELLA delivery_notes
-- =====================================================
-- job_id: usato per filtrare bolle per commessa
CREATE INDEX IF NOT EXISTS idx_delivery_notes_job_id 
ON public.delivery_notes(job_id);

-- date: usato per ordinamento e filtri temporali
CREATE INDEX IF NOT EXISTS idx_delivery_notes_date 
ON public.delivery_notes(date DESC);

-- type: usato per filtrare entry/exit/sale
CREATE INDEX IF NOT EXISTS idx_delivery_notes_type 
ON public.delivery_notes(type);

-- Indice composto per query comuni (tipo + data)
CREATE INDEX IF NOT EXISTS idx_delivery_notes_type_date 
ON public.delivery_notes(type, date DESC);

-- =====================================================
-- INDICI TABELLA delivery_note_items
-- =====================================================
-- delivery_note_id: chiave esterna, sempre usata nei JOIN
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_note_id 
ON public.delivery_note_items(delivery_note_id);

-- inventory_id: usato per cercare movimenti per articolo
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_inventory_id 
ON public.delivery_note_items(inventory_id);

-- purchase_item_id: usato per tracciabilità lotti
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_purchase_item_id 
ON public.delivery_note_items(purchase_item_id) 
WHERE purchase_item_id IS NOT NULL;

-- =====================================================
-- INDICI TABELLA purchase_items
-- =====================================================
-- purchase_id: chiave esterna per JOIN
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id 
ON public.purchase_items(purchase_id);

-- item_id: usato per cercare acquisti per articolo
CREATE INDEX IF NOT EXISTS idx_purchase_items_item_id 
ON public.purchase_items(item_id);

-- job_id: usato per acquisti diretti a cantiere
CREATE INDEX IF NOT EXISTS idx_purchase_items_job_id 
ON public.purchase_items(job_id) 
WHERE job_id IS NOT NULL;

-- =====================================================
-- INDICI TABELLA purchases
-- =====================================================
-- supplier_id: filtro per fornitore
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id 
ON public.purchases(supplier_id);

-- job_id: filtro per acquisti diretti a cantiere
CREATE INDEX IF NOT EXISTS idx_purchases_job_id 
ON public.purchases(job_id) 
WHERE job_id IS NOT NULL;

-- delivery_note_date: ordinamento cronologico
CREATE INDEX IF NOT EXISTS idx_purchases_date 
ON public.purchases(delivery_note_date DESC);

-- =====================================================
-- INDICI TABELLA jobs
-- =====================================================
-- status: filtro commesse attive/completate
CREATE INDEX IF NOT EXISTS idx_jobs_status 
ON public.jobs(status);

-- client_id: filtro per cliente
CREATE INDEX IF NOT EXISTS idx_jobs_client_id 
ON public.jobs(client_id);

-- Indice composto per lista commesse attive ordinate
CREATE INDEX IF NOT EXISTS idx_jobs_status_code 
ON public.jobs(status, code DESC);

-- =====================================================
-- INDICI TABELLA job_inventory
-- =====================================================
-- job_id: principale chiave di ricerca
CREATE INDEX IF NOT EXISTS idx_job_inventory_job_id 
ON public.job_inventory(job_id);

-- item_id: ricerca per articolo
CREATE INDEX IF NOT EXISTS idx_job_inventory_item_id 
ON public.job_inventory(item_id);

-- =====================================================
-- INDICI TABELLA inventory
-- =====================================================
-- category: filtro per categoria
CREATE INDEX IF NOT EXISTS idx_inventory_category 
ON public.inventory(category) 
WHERE category IS NOT NULL;

-- name: ricerca testuale (trigram se disponibile)
CREATE INDEX IF NOT EXISTS idx_inventory_name_trgm 
ON public.inventory USING gin(name gin_trgm_ops);

-- code: ricerca per codice
CREATE INDEX IF NOT EXISTS idx_inventory_code 
ON public.inventory(code);

-- =====================================================
-- INDICI TABELLA profiles
-- =====================================================
-- id: già primary key, ma aggiungiamo indice su role per query RLS
CREATE INDEX IF NOT EXISTS idx_profiles_role 
ON public.profiles(role);

-- =====================================================
-- ANALIZZA TABELLE per aggiornare statistiche
-- =====================================================
ANALYZE public.delivery_notes;
ANALYZE public.delivery_note_items;
ANALYZE public.purchase_items;
ANALYZE public.purchases;
ANALYZE public.jobs;
ANALYZE public.job_inventory;
ANALYZE public.inventory;
ANALYZE public.profiles;
