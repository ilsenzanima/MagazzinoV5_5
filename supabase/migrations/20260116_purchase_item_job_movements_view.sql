-- View per tracciabilità movimenti lotto-commessa
-- Mostra dove è stato movimentato il materiale di ogni lotto (purchase_item)

DROP VIEW IF EXISTS public.purchase_item_job_movements;

CREATE OR REPLACE VIEW public.purchase_item_job_movements AS
SELECT 
    dni.purchase_item_id,
    dn.job_id,
    j.code as job_code,
    j.name as job_name,
    j.description as job_description,
    -- Quantità netta verso la commessa (uscite - rientri)
    SUM(
        CASE 
            WHEN dn.type = 'exit' THEN dni.quantity
            WHEN dn.type = 'entry' THEN -dni.quantity
            ELSE 0
        END
    ) as total_quantity,
    -- Pezzi netti verso la commessa (uscite - rientri)
    SUM(
        CASE 
            WHEN dn.type = 'exit' THEN COALESCE(dni.pieces, 0)
            WHEN dn.type = 'entry' THEN -COALESCE(dni.pieces, 0)
            ELSE 0
        END
    ) as total_pieces
FROM public.delivery_note_items dni
JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
JOIN public.jobs j ON dn.job_id = j.id
WHERE dni.purchase_item_id IS NOT NULL
  AND dn.job_id IS NOT NULL
  AND dn.type IN ('exit', 'entry')
  AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
GROUP BY 
    dni.purchase_item_id, 
    dn.job_id, 
    j.code,
    j.name,
    j.description
-- Mostra solo movimenti con quantità positiva (materiale attualmente in cantiere)
HAVING SUM(
    CASE 
        WHEN dn.type = 'exit' THEN dni.quantity
        WHEN dn.type = 'entry' THEN -dni.quantity
        ELSE 0
    END
) > 0.001;

GRANT SELECT ON public.purchase_item_job_movements TO authenticated;

COMMENT ON VIEW public.purchase_item_job_movements IS 
'Vista dei movimenti per lotto e commessa. Mostra dove è stato movimentato il materiale di ogni purchase_item, aggregato per job_id.';
