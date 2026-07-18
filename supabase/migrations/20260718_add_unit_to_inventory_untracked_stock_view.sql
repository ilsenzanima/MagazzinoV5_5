-- Aggiunge l'unità di misura alla vista inventory_untracked_stock, utile per
-- mostrare la quantità fuori lotto in modo leggibile (es. "12.5 MQ").
-- CREATE OR REPLACE VIEW non permette di reinserire una colonna in mezzo
-- all'elenco esistente, quindi va aggiunta in coda.
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
    GREATEST(0, i.pieces - COALESCE(t.tracked_pieces, 0)) AS untracked_pieces,
    i.unit
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
