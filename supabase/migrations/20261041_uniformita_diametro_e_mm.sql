-- Uniformità: il diametro si scrive sempre con il simbolo "ø" (Collare e Coppella usavano la parola "Diametro")
-- e le misure in mm hanno lo spazio prima dell'unità (eseguita in produzione, approvata).
--  * schede Collare e Coppella: "[ø {diametro}] ..." al posto di "[Diametro {diametro}] ..."
--  * 13 varianti aggiornate (8 Collare, 5 Coppella) + ART-00140 "75 mm" e LAN-AFS-457 "... 600 mm"
--  * ripristino:
--      UPDATE public.inventory i SET model = l.old_model, variant_attributes = l.old_attributes
--      FROM public.variant_cleanup_log_uniformita_20261041 l WHERE i.id = l.id;
--      e nelle schede Collare/Coppella rimettere "Diametro " al posto di "ø " all'inizio del modello.
CREATE TABLE IF NOT EXISTS public.variant_cleanup_log_uniformita_20261041 AS
SELECT id, code, category, name, model AS old_model, variant_attributes AS old_attributes,
  CASE
    WHEN category IN ('Collare', 'Coppella') AND model LIKE 'Diametro %' THEN regexp_replace(model, '^Diametro ', 'ø ')
    WHEN code = 'ART-00140' THEN '75 mm'
    WHEN code = 'LAN-AFS-457' THEN 'Ampiezza nominale giunto 600 mm'
  END AS new_model,
  now() AS prepared_at
FROM public.inventory
WHERE deleted_at IS NULL AND (
  (category IN ('Collare', 'Coppella') AND model LIKE 'Diametro %') OR code IN ('ART-00140', 'LAN-AFS-457'));

UPDATE public.inventory i
SET model = l.new_model,
    variant_attributes = CASE WHEN i.code = 'LAN-AFS-457' THEN jsonb_set(i.variant_attributes, '{descrizione}', to_jsonb(l.new_model)) ELSE i.variant_attributes END
FROM public.variant_cleanup_log_uniformita_20261041 l
WHERE i.id = l.id AND i.model IS NOT DISTINCT FROM l.old_model;

UPDATE public.item_types SET variant_template = jsonb_set(variant_template, '{pattern}', '"[ø {diametro}] {altro}"'::jsonb) WHERE name = 'Collare';
UPDATE public.item_types SET variant_template = jsonb_set(variant_template, '{pattern}', '"[ø {diametro}] [sp.{spessore}] [L {lunghezza}] [densità {densita}] {altro}"'::jsonb) WHERE name = 'Coppella';
