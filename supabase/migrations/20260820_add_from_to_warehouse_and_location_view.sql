-- Persiste il magazzino scelto sul documento di movimento (finora usato solo
-- per precompilare il testo di ritiro/consegna) e calcola, per ogni lotto
-- d'acquisto, la sede attuale della merce (non solo quella di arrivo):
--   - uscita/vendita: valorizza from_warehouse_id (il "lato magazzino" del
--     documento è il ritiro)
--   - entrata/reso: valorizza to_warehouse_id (il "lato magazzino" è la
--     consegna, es. un reso da cantiere che rientra sempre a Reana)
--   - trasferimento: valorizza entrambi (magazzino di partenza e di arrivo)
--   - eccedenze: nessuno dei due (non riguarda un magazzino)

ALTER TABLE public.delivery_notes
  ADD COLUMN IF NOT EXISTS from_warehouse_id UUID REFERENCES public.warehouses(id),
  ADD COLUMN IF NOT EXISTS to_warehouse_id UUID REFERENCES public.warehouses(id);

-- Sede attuale di un lotto d'acquisto: l'ultimo movimento (per data) di tipo
-- 'transfer' o 'entry' collegato a quel lotto con un to_warehouse_id valorizzato,
-- altrimenti il magazzino di arrivo dell'acquisto (purchase_items.warehouse_id).
-- Non frazioniamo per quantità: alla scala di 1-2 bancali per volta basta
-- sapere l'ultima sede nota del lotto.
CREATE OR REPLACE VIEW public.purchase_item_current_warehouse WITH (security_invoker = true) AS
SELECT
    pi.id AS purchase_item_id,
    COALESCE(latest.to_warehouse_id, pi.warehouse_id) AS warehouse_id,
    w.name AS warehouse_name,
    w.is_primary AS warehouse_is_primary
FROM public.purchase_items pi
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
LEFT JOIN public.warehouses w ON w.id = COALESCE(latest.to_warehouse_id, pi.warehouse_id);

GRANT SELECT ON public.purchase_item_current_warehouse TO authenticated;
