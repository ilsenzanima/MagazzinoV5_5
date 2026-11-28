-- Giacenza dei lotti divisa per magazzino in base alle QUANTITA' mosse: un trasferimento parziale
-- sposta solo la quantità trasferita (prima tutto il lotto risultava nel magazzino di arrivo).
--
-- Per ogni lotto:
--   - negli altri magazzini c'è il saldo dei movimenti: trasferimenti e resi in entrata,
--     trasferimenti e uscite/vendite in uscita (i movimenti fittizi contano solo per i trasferimenti);
--   - tutto il resto sta nel magazzino di arrivo dell'acquisto.
-- La somma per lotto resta sempre uguale al residuo di purchase_batch_availability.
--
-- Per annullare:
--   rieseguire la definizione di inventory_stock_by_warehouse di 20260820c, poi
--   DROP VIEW public.purchase_item_warehouse_stock;

CREATE OR REPLACE VIEW public.purchase_item_warehouse_stock WITH (security_invoker = true) AS
WITH net AS (
    SELECT dni.purchase_item_id, m.warehouse_id, SUM(m.sign * dni.quantity) AS quantity
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn ON dn.id = dni.delivery_note_id
    CROSS JOIN LATERAL (VALUES
        (CASE WHEN dn.type = 'transfer' OR (dn.type = 'entry' AND dni.is_fictitious IS NOT TRUE)
              THEN dn.to_warehouse_id END, 1),
        (CASE WHEN dn.type = 'transfer' OR (dn.type IN ('exit', 'sale') AND dni.is_fictitious IS NOT TRUE)
              THEN dn.from_warehouse_id END, -1)
    ) AS m(warehouse_id, sign)
    WHERE dni.purchase_item_id IS NOT NULL AND m.warehouse_id IS NOT NULL
    GROUP BY dni.purchase_item_id, m.warehouse_id
),
lots AS (
    SELECT a.purchase_item_id, a.item_id,
           a.remaining_quantity AS quantity,
           a.remaining_pieces AS pieces,
           COALESCE(pi.warehouse_id, p.warehouse_id,
                    (SELECT w.id FROM public.warehouses w WHERE w.is_primary LIMIT 1)) AS base_warehouse_id
    FROM public.purchase_batch_availability a
    JOIN public.purchase_items pi ON pi.id = a.purchase_item_id
    JOIN public.purchases p ON p.id = pi.purchase_id
),
-- quantità fuori dal magazzino di arrivo, senza superare il residuo del lotto
capped AS (
    SELECT l.purchase_item_id, l.item_id, n.warehouse_id,
           LEAST(n.quantity, GREATEST(l.quantity - COALESCE(SUM(n.quantity) OVER (
               PARTITION BY l.purchase_item_id ORDER BY n.warehouse_id
               ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0), 0)) AS quantity,
           l.quantity AS lot_quantity,
           l.pieces AS lot_pieces
    FROM lots l
    JOIN net n ON n.purchase_item_id = l.purchase_item_id
    WHERE n.warehouse_id <> l.base_warehouse_id AND n.quantity > 0.001 AND l.quantity > 0.001
),
away AS (
    SELECT c.purchase_item_id, c.item_id, c.warehouse_id, c.quantity,
           c.lot_pieces * c.quantity / c.lot_quantity AS pieces
    FROM capped c
    WHERE c.quantity > 0.001
),
split AS (
    SELECT purchase_item_id, item_id, warehouse_id, quantity, pieces FROM away
    UNION ALL
    SELECT l.purchase_item_id, l.item_id, l.base_warehouse_id,
           l.quantity - COALESCE(SUM(a.quantity), 0),
           l.pieces - COALESCE(SUM(a.pieces), 0)
    FROM lots l
    LEFT JOIN away a ON a.purchase_item_id = l.purchase_item_id
    GROUP BY l.purchase_item_id, l.item_id, l.base_warehouse_id, l.quantity, l.pieces
)
SELECT s.purchase_item_id, s.item_id, s.warehouse_id,
       w.name AS warehouse_name,
       w.is_primary AS warehouse_is_primary,
       s.quantity, s.pieces
FROM split s
JOIN public.warehouses w ON w.id = s.warehouse_id;

GRANT SELECT ON public.purchase_item_warehouse_stock TO authenticated;

-- Inventario, ricerca e filtri per sede leggono da qui
CREATE OR REPLACE VIEW public.inventory_stock_by_warehouse WITH (security_invoker = true) AS
SELECT
    item_id,
    warehouse_id,
    warehouse_name,
    warehouse_is_primary,
    SUM(quantity) AS quantity,
    SUM(pieces) AS pieces
FROM public.purchase_item_warehouse_stock
GROUP BY item_id, warehouse_id, warehouse_name, warehouse_is_primary;

GRANT SELECT ON public.inventory_stock_by_warehouse TO authenticated;
