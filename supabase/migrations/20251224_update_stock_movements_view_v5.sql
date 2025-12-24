DROP VIEW IF EXISTS public.stock_movements_view;

CREATE OR REPLACE VIEW public.stock_movements_view WITH (security_invoker = true) AS
SELECT
    pi.id,
    pi.created_at as date,
    'purchase' as type,
    pi.quantity as quantity,
    p.delivery_note_number as reference,
    pi.item_id,
    p.created_by as user_id,
    pr.full_name as user_name,
    i.code as item_code,
    i.name as item_name,
    i.unit as item_unit,
    pi.price as item_price,
    pi.pieces,
    pi.coefficient,
    p.notes,
    COALESCE(pi.job_id, p.job_id) as job_id,
    j.code as job_code,
    j.description as job_description,
    FALSE as is_fictitious,
    s.name as supplier_name,
    p.delivery_note_date as purchase_date,
    p.delivery_note_number as purchase_number,
    p.id as purchase_id,
    NULL::uuid as delivery_note_id
FROM public.purchase_items pi
JOIN public.purchases p ON pi.purchase_id = p.id
LEFT JOIN public.profiles pr ON p.created_by = pr.id
LEFT JOIN public.inventory i ON pi.item_id = i.id
LEFT JOIN public.suppliers s ON p.supplier_id = s.id
LEFT JOIN public.jobs j ON COALESCE(pi.job_id, p.job_id) = j.id

UNION ALL

SELECT
    dni.id,
    dni.created_at as date,
    dn.type,
    CASE 
        WHEN dn.type = 'entry' THEN dni.quantity
        ELSE -dni.quantity
    END as quantity,
    dn.number as reference,
    dni.inventory_id as item_id,
    dn.created_by as user_id,
    pr.full_name as user_name,
    i.code as item_code,
    i.name as item_name,
    i.unit as item_unit,
    COALESCE(pi.price, i.price) as item_price,
    dni.pieces,
    dni.coefficient,
    dn.notes,
    dn.job_id,
    j.code as job_code,
    j.description as job_description,
    dni.is_fictitious,
    s.name as supplier_name,
    p.delivery_note_date as purchase_date,
    p.delivery_note_number as purchase_number,
    p.id as purchase_id,
    dn.id as delivery_note_id
FROM public.delivery_note_items dni
JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
LEFT JOIN public.profiles pr ON dn.created_by = pr.id
LEFT JOIN public.inventory i ON dni.inventory_id = i.id
LEFT JOIN public.purchase_items pi ON dni.purchase_item_id = pi.id
LEFT JOIN public.purchases p ON pi.purchase_id = p.id
LEFT JOIN public.suppliers s ON p.supplier_id = s.id
LEFT JOIN public.jobs j ON dn.job_id = j.id

UNION ALL

SELECT
    m.id,
    m.created_at as date,
    CASE
        WHEN m.type = 'load' THEN 'entry'
        WHEN m.type = 'unload' THEN 'exit'
        ELSE m.type
    END as type,
    CASE 
        WHEN m.type = 'load' THEN m.quantity
        ELSE -m.quantity
    END as quantity,
    m.reference,
    m.item_id,
    m.user_id,
    pr.full_name as user_name,
    i.code as item_code,
    i.name as item_name,
    i.unit as item_unit,
    i.price as item_price,
    NULL as pieces,
    NULL as coefficient,
    m.notes,
    m.job_id,
    j.code as job_code,
    j.description as job_description,
    FALSE as is_fictitious,
    NULL as supplier_name,
    NULL as purchase_date,
    NULL as purchase_number,
    NULL as purchase_id,
    NULL as delivery_note_id
FROM public.movements m
LEFT JOIN public.profiles pr ON m.user_id = pr.id
LEFT JOIN public.inventory i ON m.item_id = i.id
LEFT JOIN public.jobs j ON m.job_id = j.id;
