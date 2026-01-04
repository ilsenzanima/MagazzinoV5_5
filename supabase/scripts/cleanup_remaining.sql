-- Script semplificato per eliminare tutti i dati rimasti

BEGIN;

-- Verifica delivery_notes rimaste
SELECT 'DELIVERY NOTES RIMASTE:' as info;
SELECT id, number, date, type FROM delivery_notes;

-- Verifica purchases rimasti
SELECT 'PURCHASES RIMASTI:' as info;
SELECT id, delivery_note_number, delivery_note_date FROM purchases;

-- Elimina tutto
DELETE FROM delivery_notes;
DELETE FROM purchases;
DELETE FROM delivery_note_items;
DELETE FROM purchase_items;

-- Verifica finale
SELECT 
    'delivery_notes' as table_name, 
    COUNT(*) as remaining 
FROM delivery_notes
UNION ALL
SELECT 'delivery_note_items', COUNT(*) FROM delivery_note_items
UNION ALL
SELECT 'purchases', COUNT(*) FROM purchases
UNION ALL
SELECT 'purchase_items', COUNT(*) FROM purchase_items;

-- Prima volta: ROLLBACK per testare
ROLLBACK;
-- COMMIT;
