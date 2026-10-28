-- Fornitori: dati in più sulla scheda, contatti multipli, fornitori «tecnici» e vista con le statistiche.
--
-- Per annullare:
--   DROP VIEW IF EXISTS public.suppliers_overview;
--   DROP TABLE IF EXISTS public.supplier_contacts;
--   ALTER TABLE public.suppliers DROP COLUMN IF EXISTS pec, DROP COLUMN IF EXISTS website,
--     DROP COLUMN IF EXISTS payment_terms, DROP COLUMN IF EXISTS notes, DROP COLUMN IF EXISTS is_technical;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS pec text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS is_technical boolean NOT NULL DEFAULT false;

-- Voci che servono solo per inserire dati incompleti di fornitori vecchi: in elenco stanno in fondo con un'etichetta
UPDATE public.suppliers SET is_technical = true WHERE name IN ('SCONOSCIUTO', 'STORICO - Dati Incompleti');

CREATE TABLE IF NOT EXISTS public.supplier_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier_id ON public.supplier_contacts(supplier_id);

ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supplier contacts viewable by Admin/Operativo" ON public.supplier_contacts
  FOR SELECT USING ((SELECT get_my_role()) = ANY (ARRAY['admin'::text, 'operativo'::text]));
CREATE POLICY "Supplier contacts insert by Admin/Operativo" ON public.supplier_contacts
  FOR INSERT WITH CHECK ((SELECT get_my_role()) = ANY (ARRAY['admin'::text, 'operativo'::text]));
CREATE POLICY "Supplier contacts update by Admin/Operativo" ON public.supplier_contacts
  FOR UPDATE USING ((SELECT get_my_role()) = ANY (ARRAY['admin'::text, 'operativo'::text]));
CREATE POLICY "Supplier contacts delete by Admin/Operativo" ON public.supplier_contacts
  FOR DELETE USING ((SELECT get_my_role()) = ANY (ARRAY['admin'::text, 'operativo'::text]));

-- Elenco fornitori con le statistiche degli acquisti (non ordini), al netto dei resi
CREATE OR REPLACE VIEW public.suppliers_overview
WITH (security_invoker = true) AS
SELECT
  s.id, s.name, s.vat_number, s.email, s.phone, s.address, s.pec, s.website, s.payment_terms, s.notes,
  s.is_technical, s.created_at,
  COALESCE(st.purchases_count, 0)  AS purchases_count,
  st.last_purchase_date,
  COALESCE(st.spent_total, 0)      AS spent_total,
  COALESCE(st.spent_year, 0)       AS spent_year,
  (NULLIF(btrim(COALESCE(s.vat_number, '')), '') IS NULL) AS missing_vat,
  (NULLIF(btrim(COALESCE(s.email, '')), '') IS NULL)      AS missing_email,
  (NULLIF(btrim(COALESCE(s.phone, '')), '') IS NULL)      AS missing_phone
FROM public.suppliers s
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT pu.id)          AS purchases_count,
    MAX(pu.delivery_note_date)     AS last_purchase_date,
    SUM(line.amount)               AS spent_total,
    SUM(line.amount) FILTER (WHERE date_part('year', pu.delivery_note_date) = date_part('year', CURRENT_DATE)) AS spent_year
  FROM public.purchases pu
  LEFT JOIN LATERAL (
    SELECT COALESCE(pi.price, 0) * COALESCE(pi.quantity, 1)
           - CASE WHEN pi.returned_at IS NOT NULL AND pi.returned_price IS NOT NULL AND pi.returned_quantity IS NOT NULL
                  THEN pi.returned_quantity * pi.returned_price ELSE 0 END AS amount
    FROM public.purchase_items pi WHERE pi.purchase_id = pu.id
  ) line ON true
  WHERE pu.supplier_id = s.id AND pu.deleted_at IS NULL AND pu.order_type = 'purchase'
) st ON true
WHERE s.deleted_at IS NULL;

GRANT SELECT ON public.suppliers_overview TO authenticated;
