-- View to show inventory at a job site broken down by purchase batch
-- Used for returning items from a job (Entry) while maintaining batch traceability

CREATE OR REPLACE VIEW public.job_batch_availability AS
SELECT 
    dn.job_id,
    dni.inventory_id as item_id,
    dni.purchase_item_id,
    -- If purchase_item_id is null, we might not have a ref. 
    COALESCE(p.delivery_note_number, 'N/A') as purchase_ref,
    i.name as item_name,
    i.code as item_code,
    i.unit as item_unit,
    i.brand as item_brand,
    i.category as item_category,
    
    -- Quantity Calculation: Exits (sent to job) - Entries (returned from job)
    SUM(CASE WHEN dn.type = 'exit' THEN dni.quantity ELSE 0 END) -
    SUM(CASE WHEN dn.type = 'entry' THEN dni.quantity ELSE 0 END) as quantity,
    
    -- Pieces Calculation
    SUM(CASE WHEN dn.type = 'exit' THEN dni.pieces ELSE 0 END) -
    SUM(CASE WHEN dn.type = 'entry' THEN dni.pieces ELSE 0 END) as pieces,

    dni.coefficient

FROM public.delivery_note_items dni
JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
LEFT JOIN public.purchase_items pi ON dni.purchase_item_id = pi.id
LEFT JOIN public.purchases p ON pi.purchase_id = p.id
LEFT JOIN public.inventory i ON dni.inventory_id = i.id
WHERE dn.job_id IS NOT NULL 
  AND dn.type IN ('exit', 'entry')
  AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
GROUP BY 
    dn.job_id, 
    dni.inventory_id, 
    dni.purchase_item_id, 
    p.delivery_note_number, 
    i.name, 
    i.code, 
    i.unit,
    i.brand,
    i.category,
    dni.coefficient
HAVING 
    (SUM(CASE WHEN dn.type = 'exit' THEN dni.quantity ELSE 0 END) - 
     SUM(CASE WHEN dn.type = 'entry' THEN dni.quantity ELSE 0 END)) > 0.001;

GRANT SELECT ON public.job_batch_availability TO authenticated;
