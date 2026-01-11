-- Verifica prezzi unitari per gli articoli sospetti (CORRETTO v2)
SELECT 
    i.code, 
    i.name, 
    p.delivery_note_number as "Numero DDT", 
    pi.price as "Prezzo Unitario", 
    pi.quantity as "Quantità",
    pi.pieces as "Pezzi",
    p.created_at as "Data Acquisto",
    p.notes as "Note Acquisto"
FROM purchase_items pi
JOIN inventory i ON pi.item_id = i.id
LEFT JOIN purchases p ON pi.purchase_id = p.id
WHERE i.code IN ('COL-PRO-20', 'LAN-ISO-245')
AND pi.price > 0;
