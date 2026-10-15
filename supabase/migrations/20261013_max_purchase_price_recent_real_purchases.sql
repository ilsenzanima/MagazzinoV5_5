-- Prezzo "massimo d'acquisto" per articolo (usato da Analisi Costi, offerte e prezzi di commessa).
--
-- Prima: massimo di TUTTE le righe di purchase_items, ordini e acquisti cancellati compresi.
-- Un ordine puo' avere un prezzo diverso da quello dell'acquisto effettivo (es. riga in confezioni,
-- poi convertita in acquisto in ML) e restava nel database come residuo: il prezzo sbagliato
-- diventava il prezzo di commessa.
--
-- Ora:
--   * si contano solo gli acquisti veri (order_type = 'purchase') e non cancellati
--   * prezzo piu' alto degli ultimi 6 mesi (data della bolla)
--   * se negli ultimi 6 mesi non ci sono acquisti: prezzo dell'ultimo acquisto (data bolla piu' recente)
CREATE OR REPLACE FUNCTION public.get_max_purchase_prices(item_ids uuid[])
 RETURNS TABLE(item_id uuid, max_price numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    WITH real_purchases AS (
        SELECT pi.item_id,
               pi.price,
               COALESCE(pu.delivery_note_date::date, pu.created_at::date) AS d,
               pu.created_at AS c
        FROM purchase_items pi
        JOIN purchases pu ON pu.id = pi.purchase_id
        WHERE pi.item_id = ANY(item_ids)
          AND pi.price IS NOT NULL
          AND pu.order_type = 'purchase'
          AND pu.deleted_at IS NULL
    ),
    recent AS (
        SELECT rp.item_id, MAX(rp.price) AS p
        FROM real_purchases rp
        WHERE rp.d >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY rp.item_id
    ),
    latest AS (
        SELECT DISTINCT ON (rp.item_id) rp.item_id, rp.price AS p
        FROM real_purchases rp
        ORDER BY rp.item_id, rp.d DESC, rp.c DESC
    )
    SELECT l.item_id, COALESCE(r.p, l.p)
    FROM latest l
    LEFT JOIN recent r ON r.item_id = l.item_id;
$function$;
