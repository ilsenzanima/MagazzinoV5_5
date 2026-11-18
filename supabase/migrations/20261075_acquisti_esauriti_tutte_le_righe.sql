-- Un acquisto risultava «esaurito» appena UNA sua riga non aveva più nulla in magazzino, invece di tutte
-- (il commento della funzione originale diceva «tutte le righe», la query faceva «almeno una»).
-- Caso tipico: acquisto arrivato direttamente in cantiere, con alcune righe poi rientrate in magazzino:
-- le righe rientrate hanno giacenza, ma l'acquisto restava segnato esaurito per le altre righe a zero.
-- Ora è esaurito solo se nessuna riga ha più materiale disponibile.
--
-- Per annullare: ripristinare la definizione di 20260117_exhausted_purchases_rpc.sql (con search_path = public).

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
    JOIN purchase_batch_availability pba ON pba.purchase_item_id = pi.id
    WHERE pi.purchase_id = p.id
    AND pba.remaining_quantity > 0.001
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_exhausted_purchase_ids() TO authenticated;
