-- Query per trovare i lotti di un articolo (inclusi acquisti su commessa)
-- Sostituisci 'NOME_ARTICOLO_O_CODICE' con parte del nome o codice
SELECT 
    pi.id as purchase_item_id,
    p.delivery_note_number as numero_bolla_acquisto,
    p.delivery_note_date as data_bolla,
    p.job_id,
    j.code as codice_commessa,
    pi.quantity as quantita_acquisto,
    i.name as nome_articolo,
    pi.item_id
FROM purchase_items pi
JOIN purchases p ON pi.purchase_id = p.id
JOIN inventory i ON pi.item_id = i.id
LEFT JOIN jobs j ON p.job_id = j.id
WHERE i.name ILIKE '%NOME_ARTICOLO_O_CODICE%' OR i.code ILIKE '%NOME_ARTICOLO_O_CODICE%';
