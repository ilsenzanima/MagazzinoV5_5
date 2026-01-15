-- Script per pulire il campo legacy inventory.pieces
-- Questo campo non viene più usato per i report, lo stock viene calcolato dai lotti tracciati

-- Prima verifichiamo cosa verrà modificato
SELECT 
  i.code,
  i.name,
  i.pieces as "inventory.pieces (attuale)",
  (
    SELECT COUNT(*) FROM purchase_items pi WHERE pi.item_id = i.id
  ) as "N. acquisti tracciati"
FROM inventory i
WHERE EXISTS (
  SELECT 1 FROM purchase_items pi WHERE pi.item_id = i.id
)
AND i.pieces > 0
ORDER BY i.code;

-- Se i risultati sono corretti, esegui questo UPDATE:

UPDATE inventory i
SET pieces = 0
WHERE EXISTS (
  SELECT 1 FROM purchase_items pi WHERE pi.item_id = i.id
)
AND i.pieces > 0;

