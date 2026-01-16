-- Diagnosi per la view job_batch_availability
-- Esegui questo script nel SQL Editor di Supabase per capire perché il materiale non appare

-- 1. Verifica un job specifico (sostituisci l'ID)
-- Prima trova l'ID del job CX-Place
SELECT id, code, description FROM jobs WHERE code LIKE '%CXX%' LIMIT 5;

-- 2. Una volta trovato l'ID, verifica i movimenti verso quel job
-- Sostituisci 'JOB_ID_HERE' con l'ID reale
/*
SELECT 
    dn.id as delivery_note_id,
    dn.number,
    dn.type,
    dni.inventory_id,
    i.name as item_name,
    dni.quantity,
    dni.purchase_item_id,
    dni.is_fictitious
FROM delivery_notes dn
JOIN delivery_note_items dni ON dni.delivery_note_id = dn.id
JOIN inventory i ON dni.inventory_id = i.id
WHERE dn.job_id = 'JOB_ID_HERE'
ORDER BY dn.date DESC;
*/

-- 3. Verifica cosa ritorna la view per il job
/*
SELECT * FROM job_batch_availability WHERE job_id = 'JOB_ID_HERE';
*/

-- 4. Verifica acquisti diretti su quel job
/*
SELECT 
    p.id as purchase_id,
    p.delivery_note_number,
    p.job_id,
    pi.id as purchase_item_id,
    i.name as item_name,
    pi.quantity
FROM purchases p
JOIN purchase_items pi ON pi.purchase_id = p.id
JOIN inventory i ON pi.item_id = i.id
WHERE p.job_id = 'JOB_ID_HERE';
*/

-- 5. Debug specifico: verifica la logica NOT IN
-- Questo dovrebbe mostrare gli item che vengono ESCLUSI perché considerati acquisti diretti
SELECT 
    dni.id,
    dni.purchase_item_id,
    dn.job_id,
    dn.type,
    'ESCLUSO - È UN ACQUISTO DIRETTO' as reason
FROM delivery_note_items dni
JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
WHERE dn.job_id IS NOT NULL
  AND dni.purchase_item_id IN (
      SELECT pi.id 
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      WHERE p.job_id IS NOT NULL
  )
LIMIT 20;
