-- ⚠️ FORCE DATA CLEANUP SCRIPT
-- Executes a TRUNCATE CASCADE on all transactional tables simultaneously.
-- This bypasses row-level triggers and handles foreign key constraints automatically.

BEGIN;

-- Truncate all tables in one go to avoid FK issues and trigger side effects
TRUNCATE TABLE 
    inventory,
    purchases,
    delivery_notes,
    jobs,
    clients,
    suppliers,
    inventory_supplier_codes,
    purchase_items,
    delivery_note_items,
    job_inventory,
    job_logs,
    job_documents
RESTART IDENTITY CASCADE;

-- Verify cleanup
SELECT 
    'inventory' as table_name, count(*) as count FROM inventory
UNION ALL
SELECT 'purchases', count(*) FROM purchases
UNION ALL
SELECT 'delivery_notes', count(*) FROM delivery_notes;

-- Uncomment the commit line to apply changes
ROLLBACK;
-- COMMIT;
