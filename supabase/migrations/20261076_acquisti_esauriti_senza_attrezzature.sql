-- Un acquisto è «esaurito» quando non resta più materiale: le attrezzature non contano.
-- Se l'acquisto ha materiali di consumo, un'attrezzatura ancora presente non lo rende più «non esaurito».
-- Se invece contiene solo attrezzature, vale come prima: esaurito quando nessuna riga ha più disponibilità.
--
-- Per annullare: ripristinare la definizione di 20261075_acquisti_esauriti_tutte_le_righe.sql.

CREATE OR REPLACE FUNCTION public.get_exhausted_purchase_ids()
RETURNS TABLE (purchase_id uuid)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.id
  FROM purchases p
  WHERE EXISTS (SELECT 1 FROM purchase_items pi WHERE pi.purchase_id = p.id)
  AND NOT EXISTS (
    SELECT 1
    FROM purchase_items pi
    JOIN inventory i ON i.id = pi.item_id
    JOIN purchase_batch_availability pba ON pba.purchase_item_id = pi.id
    WHERE pi.purchase_id = p.id
    AND pba.remaining_quantity > 0.001
    AND (
      LOWER(COALESCE(i.category, '')) <> 'attrezzatura'
      OR NOT EXISTS (
        SELECT 1 FROM purchase_items pi2
        JOIN inventory i2 ON i2.id = pi2.item_id
        WHERE pi2.purchase_id = p.id AND LOWER(COALESCE(i2.category, '')) <> 'attrezzatura'
      )
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_exhausted_purchase_ids() TO authenticated;
