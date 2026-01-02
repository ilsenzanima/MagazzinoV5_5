-- View dettagliata per tracciabilità lotti in cantiere (2026-01-02)
-- Mostra righe separate per ogni lotto con aggregazione bolle carico/scarico

CREATE OR REPLACE VIEW public.job_batch_detailed AS
SELECT 
    dn.job_id,
    dni.inventory_id as item_id,
    i.code as item_code,
    i.name as item_name,
    i.unit as item_unit,
    dni.purchase_item_id,
    
    -- Riferimento acquisto (bolla fornitore)
    p.delivery_note_number as purchase_ref,
    p.delivery_note_date as purchase_date,
    s.name as supplier_name,
    
    -- Aggregazione bolle di carico (uscite verso cantiere)
    STRING_AGG(
        DISTINCT CASE WHEN dn.type = 'exit' THEN dn.number END, 
        ', ' 
        ORDER BY CASE WHEN dn.type = 'exit' THEN dn.number END
    ) as exit_delivery_notes,
    
    -- Aggregazione bolle di scarico (rientri da cantiere)
    STRING_AGG(
        DISTINCT CASE WHEN dn.type = 'entry' THEN dn.number END, 
        ', ' 
        ORDER BY CASE WHEN dn.type = 'entry' THEN dn.number END
    ) as entry_delivery_notes,
    
    -- Calcolo quantità attuale per lotto
    SUM(
        CASE 
            WHEN dn.type = 'exit' THEN dni.quantity
            WHEN dn.type = 'entry' THEN -dni.quantity
            ELSE 0
        END
    ) as current_quantity,
    
    SUM(
        CASE 
            WHEN dn.type = 'exit' THEN COALESCE(dni.pieces, 0)
            WHEN dn.type = 'entry' THEN -COALESCE(dni.pieces, 0)
            ELSE 0
        END
    ) as current_pieces

FROM public.delivery_note_items dni
JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
JOIN public.inventory i ON dni.inventory_id = i.id
LEFT JOIN public.purchase_items pi ON dni.purchase_item_id = pi.id
LEFT JOIN public.purchases p ON pi.purchase_id = p.id
LEFT JOIN public.suppliers s ON p.supplier_id = s.id

WHERE dn.job_id IS NOT NULL 
  AND dn.type IN ('exit', 'entry')
  AND dni.purchase_item_id IS NOT NULL

GROUP BY 
    dn.job_id,
    dni.inventory_id,
    i.code,
    i.name,
    i.unit,
    dni.purchase_item_id,
    p.delivery_note_number,
    p.delivery_note_date,
    s.name

HAVING SUM(
    CASE 
        WHEN dn.type = 'exit' THEN dni.quantity
        WHEN dn.type = 'entry' THEN -dni.quantity
        ELSE 0
    END
) > 0.001;

COMMENT ON VIEW public.job_batch_detailed IS 
'Vista dettagliata giacenza cantiere per lotto. Mostra righe separate per ogni lotto (purchase_item_id) con aggregazione bolle di carico/scarico.';
