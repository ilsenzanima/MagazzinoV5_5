-- Vista aggregata "fuori lotto": per ogni articolo confronta lo stock totale
-- (inventory.quantity/pieces) con la somma di quanto risulta ancora
-- disponibile nei lotti d'acquisto (purchase_batch_availability, già
-- allineata alla logica di getLotsForItem in src/lib/services/inventory.ts).
-- La differenza positiva è stock non riconducibile a nessun lotto: succede
-- per errori di movimentazione (uscite/entrate non agganciate al lotto
-- giusto) o per modifiche a un acquisto dopo che è già stato in parte
-- scaricato.
--
-- A differenza del calcolo per-articolo in getLotsForItem (che gira una
-- query alla volta), questa vista calcola tutti gli articoli in un solo
-- giro, aggregando purchase_batch_availability per item_id: è quella da
-- interrogare per un controllo massivo su tutto il magazzino.
CREATE OR REPLACE VIEW public.inventory_untracked_stock
WITH (security_invoker = true) AS
SELECT
    i.id AS item_id,
    i.code,
    i.name,
    i.brand,
    i.model,
    i.quantity AS total_quantity,
    i.pieces AS total_pieces,
    COALESCE(t.tracked_quantity, 0) AS tracked_quantity,
    COALESCE(t.tracked_pieces, 0) AS tracked_pieces,
    GREATEST(0, i.quantity - COALESCE(t.tracked_quantity, 0)) AS untracked_quantity,
    GREATEST(0, i.pieces - COALESCE(t.tracked_pieces, 0)) AS untracked_pieces
FROM public.inventory i
LEFT JOIN (
    SELECT
        item_id,
        SUM(remaining_quantity) AS tracked_quantity,
        SUM(remaining_pieces) AS tracked_pieces
    FROM public.purchase_batch_availability
    GROUP BY item_id
) t ON t.item_id = i.id
WHERE i.deleted_at IS NULL;

COMMENT ON VIEW public.inventory_untracked_stock IS
    'Per ogni articolo attivo: stock totale, stock tracciato sui lotti d''acquisto (da purchase_batch_availability) e la differenza (untracked_quantity/untracked_pieces). Filtra su untracked_quantity > tolleranza per trovare gli articoli con stock fuori lotto.';
