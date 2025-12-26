-- View to show inventory at a job site broken down by purchase batch
-- Used for returning items from a job (Entry) while maintaining batch traceability
-- Updated to include Direct Purchases (Purchases linked to a job)

DROP VIEW IF EXISTS public.job_batch_availability;

CREATE OR REPLACE VIEW public.job_batch_availability WITH (security_invoker = true) AS
WITH 
-- 1. Movimenti da Magazzino (Exit = + al cantiere, Entry = - dal cantiere)
warehouse_movements AS (
    SELECT 
        dn.job_id,
        dni.inventory_id as item_id,
        dni.purchase_item_id,
        CASE 
            WHEN dn.type = 'exit' THEN dni.quantity 
            WHEN dn.type = 'entry' THEN -dni.quantity 
            ELSE 0 
        END as quantity,
        CASE 
            WHEN dn.type = 'exit' THEN dni.pieces 
            WHEN dn.type = 'entry' THEN -dni.pieces 
            ELSE 0 
        END as pieces,
        dni.coefficient
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
    WHERE dn.job_id IS NOT NULL 
      AND dn.type IN ('exit', 'entry')
      AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
),
-- 2. Acquisti Diretti su Cantiere (Sempre + al cantiere)
-- Per questi, usiamo l'ID dell'item di acquisto come purchase_item_id per tracciabilità
direct_purchases AS (
    SELECT
        p.job_id,
        pi.item_id,
        pi.id as purchase_item_id,
        pi.quantity,
        pi.pieces,
        pi.coefficient
    FROM public.purchase_items pi
    JOIN public.purchases p ON pi.purchase_id = p.id
    WHERE p.job_id IS NOT NULL
)
SELECT 
    combined.job_id,
    combined.item_id,
    combined.purchase_item_id,
    COALESCE(p.delivery_note_number, 'N/A') as purchase_ref,
    i.name as item_name,
    i.model as item_model,
    i.code as item_code,
    i.unit as item_unit,
    i.brand as item_brand,
    i.category as item_category,
    
    SUM(combined.quantity) as quantity,
    SUM(combined.pieces) as pieces,
    combined.coefficient

FROM (
    SELECT * FROM warehouse_movements
    UNION ALL
    SELECT * FROM direct_purchases
) combined
JOIN public.inventory i ON combined.item_id = i.id
LEFT JOIN public.purchase_items pi ON combined.purchase_item_id = pi.id
LEFT JOIN public.purchases p ON pi.purchase_id = p.id

GROUP BY 
    combined.job_id, 
    combined.item_id, 
    combined.purchase_item_id, 
    p.delivery_note_number, 
    i.name, 
    i.model,
    i.code, 
    i.unit,
    i.brand,
    i.category,
    combined.coefficient
HAVING 
    SUM(combined.quantity) > 0.001;

GRANT SELECT ON public.job_batch_availability TO authenticated;
