-- Magazzino generale d'intestazione per un acquisto: si applica come default
-- a tutte le righe che non hanno un proprio warehouse_id esplicito (stesso
-- pattern già usato per job_id, ma qui senza bisogno di trigger perché il
-- campo è puramente informativo e non sposta giacenza).
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id);

-- Aggiorna la vista "sede attuale" del lotto perché, quando la riga non ha un
-- proprio warehouse_id, ricada sul magazzino generale dell'acquisto invece
-- che restare NULL.
CREATE OR REPLACE VIEW public.purchase_item_current_warehouse WITH (security_invoker = true) AS
SELECT
    pi.id AS purchase_item_id,
    COALESCE(latest.to_warehouse_id, pi.warehouse_id, p.warehouse_id) AS warehouse_id,
    w.name AS warehouse_name,
    w.is_primary AS warehouse_is_primary
FROM public.purchase_items pi
JOIN public.purchases p ON p.id = pi.purchase_id
LEFT JOIN LATERAL (
    SELECT dn.to_warehouse_id
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
    WHERE dni.purchase_item_id = pi.id
      AND dn.type IN ('transfer', 'entry')
      AND dn.to_warehouse_id IS NOT NULL
    ORDER BY dn.date DESC, dni.created_at DESC
    LIMIT 1
) latest ON true
LEFT JOIN public.warehouses w ON w.id = COALESCE(latest.to_warehouse_id, pi.warehouse_id, p.warehouse_id);

GRANT SELECT ON public.purchase_item_current_warehouse TO authenticated;
