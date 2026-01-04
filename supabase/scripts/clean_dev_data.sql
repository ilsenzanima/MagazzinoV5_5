-- ⚠️ ATTENZIONE: Questo script elimina TUTTI i dati transazionali
-- Mantiene solo: users, profiles, workers, settings, brands, item_types, units, warehouses
-- DA ESEGUIRE SOLO IN AMBIENTE DI SVILUPPO/STAGING

BEGIN;

-- Elimina tutti i dati transazionali usando TRUNCATE CASCADE
-- CASCADE elimina automaticamente anche le righe dipendenti in altre tabelle

-- 1. Elimina inventario (CASCADE elimina anche inventory_supplier_codes, delivery_note_items, purchase_items)
TRUNCATE TABLE inventory CASCADE;

-- 2. Elimina acquisti (CASCADE elimina purchase_items se non già eliminati)
TRUNCATE TABLE purchases CASCADE;

-- 3. Elimina bolle (CASCADE elimina delivery_note_items se non già eliminati)
TRUNCATE TABLE delivery_notes CASCADE;

-- 4. Elimina commesse (CASCADE elimina job_logs, job_documents, job_inventory)
TRUNCATE TABLE jobs CASCADE;

-- 5. Elimina clienti e fornitori
TRUNCATE TABLE clients CASCADE;
TRUNCATE TABLE suppliers CASCADE;

-- Verifica che tutto sia vuoto
SELECT 
    'delivery_notes' as table_name, 
    COUNT(*) as remaining_rows 
FROM delivery_notes
UNION ALL
SELECT 'delivery_note_items', COUNT(*) FROM delivery_note_items
UNION ALL
SELECT 'purchases', COUNT(*) FROM purchases
UNION ALL
SELECT 'purchase_items', COUNT(*) FROM purchase_items
UNION ALL
SELECT 'jobs', COUNT(*) FROM jobs
UNION ALL
SELECT 'job_logs', COUNT(*) FROM job_logs
UNION ALL
SELECT 'job_documents', COUNT(*) FROM job_documents
UNION ALL
SELECT 'job_inventory', COUNT(*) FROM job_inventory
UNION ALL
SELECT 'clients', COUNT(*) FROM clients
UNION ALL
SELECT 'suppliers', COUNT(*) FROM suppliers
UNION ALL
SELECT 'inventory', COUNT(*) FROM inventory
UNION ALL
SELECT 'inventory_supplier_codes', COUNT(*) FROM inventory_supplier_codes
ORDER BY table_name;

-- IMPORTANTE: Per sicurezza, fa ROLLBACK la prima volta per verificare
-- Poi commenta ROLLBACK e decommenta COMMIT per applicare definitivamente
ROLLBACK;
-- COMMIT;
