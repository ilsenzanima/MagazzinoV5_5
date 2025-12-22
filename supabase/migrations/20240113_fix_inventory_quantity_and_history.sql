-- 1. Change inventory quantity to numeric to support decimal units (e.g. MQ)
ALTER TABLE public.inventory ALTER COLUMN quantity TYPE NUMERIC(10, 2);

-- 2. Add created_by to delivery_notes for audit
ALTER TABLE public.delivery_notes ADD COLUMN IF NOT EXISTS created_by uuid references auth.users(id);

-- 3. Create Unified Stock Movements View
CREATE OR REPLACE VIEW public.stock_movements_view AS
SELECT
    pi.id,
    pi.created_at as date,
    'purchase' as type,
    pi.quantity as quantity, -- Purchases always add stock
    p.delivery_note_number as reference,
    pi.item_id,
    p.created_by as user_id,
    pi.pieces::numeric(10,2) as pieces,
    pi.coefficient::numeric(10,2) as coefficient,
    p.notes
FROM public.purchase_items pi
JOIN public.purchases p ON pi.purchase_id = p.id

UNION ALL

SELECT
    dni.id,
    dni.created_at as date,
    dn.type, -- 'entry', 'exit', 'sale'
    CASE 
        WHEN dn.type = 'entry' THEN dni.quantity
        ELSE -dni.quantity
    END as quantity,
    dn.number as reference,
    dni.inventory_id as item_id,
    dn.created_by as user_id,
    dni.pieces::numeric(10,2) as pieces,
    dni.coefficient::numeric(10,2) as coefficient,
    dn.notes
FROM public.delivery_note_items dni
JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id;

-- 4. Grant access to view
GRANT SELECT ON public.stock_movements_view TO authenticated;
