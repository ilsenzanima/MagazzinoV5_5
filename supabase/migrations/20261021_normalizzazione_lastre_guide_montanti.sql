-- Normalizzazione degli articoli esistenti di Lastre e Guide e Montanti secondo le schede varianti
-- (già eseguita su produzione il 2026-10-20 e approvata riga per riga).
--  * il testo della variante usa il formato della scheda (es. "1200x2500 sp.12,5", "150x80x4000 sp.8/10")
--  * i valori strutturati si salvano in inventory.variant_attributes
--  * i valori precedenti restano in variant_normalization_log_20261020 per un eventuale ripristino:
--      UPDATE public.inventory i SET model = l.old_model, variant_attributes = l.old_attributes
--      FROM public.variant_normalization_log_20261020 l WHERE i.id = l.id;
CREATE TABLE IF NOT EXISTS public.variant_normalization_log_20261020 AS
WITH base AS (
  SELECT id, code, category, name, model, variant_attributes FROM public.inventory
  WHERE deleted_at IS NULL AND category IN ('Lastre','Guide e Montanti')
),
l AS (
  SELECT b.*,
    (regexp_match(trim(model), '^(\d+)x(\d+)(?:\s*sp\.?\s*([\d.,]+)|x([\d.,]+))(?:\s+(.+))?$')) lr,
    (regexp_match(trim(model), '^\.?(\d+)x(\d+)x(\d+)(?:\s*sp\.?\s*(\d+/\d+))?$')) g
  FROM base b
)
SELECT id, code, category, name,
  model AS old_model,
  variant_attributes AS old_attributes,
  CASE
    WHEN category = 'Lastre' THEN lr[1] || 'x' || lr[2] || ' sp.' || replace(coalesce(lr[3], lr[4]), '.', ',') || coalesce(' ' || lr[5], '')
    ELSE g[1] || 'x' || g[2] || 'x' || g[3] || CASE WHEN g[4] IS NOT NULL AND g[4] <> '6/10' THEN ' sp.' || g[4] ELSE '' END
  END AS new_model,
  CASE
    WHEN category = 'Lastre' THEN jsonb_strip_nulls(jsonb_build_object(
        'larghezza', lr[1], 'lunghezza', lr[2], 'spessore', replace(coalesce(lr[3], lr[4]), '.', ','), 'altro', lr[5]))
    ELSE jsonb_build_object('larghezza', g[1], 'ala', g[2], 'lunghezza', g[3], 'spessore', coalesce(g[4], '6/10'))
  END AS new_attributes,
  now() AS prepared_at
FROM l
WHERE (category = 'Lastre' AND lr IS NOT NULL) OR (category = 'Guide e Montanti' AND g IS NOT NULL);

UPDATE public.inventory i
SET model = p.new_model, variant_attributes = p.new_attributes
FROM public.variant_normalization_log_20261020 p
WHERE i.id = p.id AND i.model IS NOT DISTINCT FROM p.old_model;
