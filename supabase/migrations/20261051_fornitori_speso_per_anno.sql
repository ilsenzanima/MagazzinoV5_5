-- Elenco fornitori con il «speso» di un anno a scelta (la vista suppliers_overview lo calcola solo per l'anno corrente)
-- e anni in cui ci sono acquisti, per il menu a tendina nell'intestazione della colonna.
--
-- Per annullare:
--   DROP FUNCTION IF EXISTS public.suppliers_overview_for_year(integer);
--   DROP FUNCTION IF EXISTS public.supplier_purchase_years();

CREATE OR REPLACE FUNCTION public.suppliers_overview_for_year(p_year integer)
RETURNS TABLE (
  id uuid, name text, vat_number text, email text, phone text, address text, pec text, website text,
  payment_terms text, notes text, is_technical boolean, created_at timestamptz,
  purchases_count bigint, last_purchase_date date, spent_total numeric, spent_year numeric,
  missing_vat boolean, missing_email boolean, missing_phone boolean
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    o.id, o.name, o.vat_number, o.email, o.phone, o.address, o.pec, o.website,
    o.payment_terms, o.notes, o.is_technical, o.created_at,
    o.purchases_count, o.last_purchase_date, o.spent_total,
    COALESCE((
      SELECT SUM(
        COALESCE(pi.price, 0) * COALESCE(pi.quantity, 1)
        - CASE WHEN pi.returned_at IS NOT NULL AND pi.returned_price IS NOT NULL AND pi.returned_quantity IS NOT NULL
               THEN pi.returned_quantity * pi.returned_price ELSE 0 END)
      FROM purchases pu
      JOIN purchase_items pi ON pi.purchase_id = pu.id
      WHERE pu.supplier_id = o.id AND pu.deleted_at IS NULL AND pu.order_type = 'purchase'
        AND date_part('year', pu.delivery_note_date) = p_year
    ), 0) AS spent_year,
    o.missing_vat, o.missing_email, o.missing_phone
  FROM suppliers_overview o
$$;

CREATE OR REPLACE FUNCTION public.supplier_purchase_years()
RETURNS SETOF integer
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT date_part('year', delivery_note_date)::integer
  FROM purchases
  WHERE deleted_at IS NULL AND order_type = 'purchase' AND delivery_note_date IS NOT NULL
  ORDER BY 1 DESC
$$;
