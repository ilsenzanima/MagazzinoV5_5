-- Elenco unico acquisti / ordini / fatture (pagina Acquisti in formato tabella).
-- La vista serve solo a filtrare, ordinare e contare: i dettagli di ogni riga si leggono dalle tabelle originali.
-- security_invoker: valgono le stesse regole di accesso delle tabelle purchases e invoices.
--
-- Per annullare:  DROP VIEW IF EXISTS public.purchase_documents;

CREATE OR REPLACE VIEW public.purchase_documents
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.order_type                       AS doc_type,      -- 'purchase' | 'order'
  p.delivery_note_number             AS doc_number,
  p.delivery_note_date               AS doc_date,
  p.supplier_id,
  s.name                             AS supplier_name,
  COALESCE((
    SELECT SUM(COALESCE(pi.price, 0) * COALESCE(pi.quantity, 1))
    FROM public.purchase_items pi
    WHERE pi.purchase_id = p.id
  ), 0)                              AS total_amount,
  lower(concat_ws(' ',
    p.delivery_note_number, s.name, p.notes, j.code, j.name, c.name,
    (SELECT string_agg(concat_ws(' ', i.name, i.model), ' ')
       FROM public.purchase_items pi
       JOIN public.inventory i ON i.id = pi.item_id
      WHERE pi.purchase_id = p.id)
  ))                                 AS search_text
FROM public.purchases p
LEFT JOIN public.suppliers s ON s.id = p.supplier_id
LEFT JOIN public.jobs j ON j.id = p.job_id
LEFT JOIN public.clients c ON c.id = j.client_id
WHERE p.deleted_at IS NULL

UNION ALL

SELECT
  inv.id,
  'invoice'::text                    AS doc_type,
  inv.invoice_number                 AS doc_number,
  inv.invoice_date                   AS doc_date,
  inv.supplier_id,
  s.name                             AS supplier_name,
  COALESCE((
    SELECT SUM(
      COALESCE(pi.price, 0) * COALESCE(pi.quantity, 1)
      - CASE WHEN pi.returned_at IS NOT NULL AND pi.returned_price IS NOT NULL AND pi.returned_quantity IS NOT NULL
             THEN pi.returned_quantity * pi.returned_price ELSE 0 END
    )
    FROM public.purchases p2
    JOIN public.purchase_items pi ON pi.purchase_id = p2.id
    WHERE p2.invoice_id = inv.id AND p2.deleted_at IS NULL
  ), 0)                              AS total_amount,
  lower(concat_ws(' ',
    inv.invoice_number, s.name, inv.notes,
    (SELECT string_agg(p3.delivery_note_number, ' ')
       FROM public.purchases p3
      WHERE p3.invoice_id = inv.id AND p3.deleted_at IS NULL)
  ))                                 AS search_text
FROM public.invoices inv
LEFT JOIN public.suppliers s ON s.id = inv.supplier_id
WHERE inv.deleted_at IS NULL;

GRANT SELECT ON public.purchase_documents TO authenticated;
