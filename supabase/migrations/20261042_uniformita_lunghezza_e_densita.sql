-- Uniformità (approvata): lunghezza sempre "L n mm" e densità sempre con l'unità "kg/m³"
--  * Coppella: "[L {lunghezza} mm]" e "[densità {densita} kg/m³]"; 3 coppelle Armaflex "L 2000 mm", coppella lana di roccia "densità 50 kg/m³"
--  * Profilati, profili controsoffitto: "[L {lunghezza} mm]" al posto di "lung."; i 3 portanti a T diventano "T L 1200 mm" ecc.
--  * ripristino: UPDATE public.inventory i SET model = l.old_model
--      FROM public.variant_cleanup_log_uniformita2_20261042 l WHERE i.id = l.id;
--    e nelle due schede rimettere "[L {lunghezza}] [densità {densita}]" (Coppella) e "[lung. {lunghezza}]" (Profilati).
CREATE TABLE IF NOT EXISTS public.variant_cleanup_log_uniformita2_20261042 AS
SELECT id, code, category, name, model AS old_model,
  CASE
    WHEN category = 'Coppella' AND model ~ ' L \d+$' THEN model || ' mm'
    WHEN code = 'COP-NUL-023' THEN model || ' kg/m³'
    WHEN code IN ('PRO-ATE-108', 'PRO-ATE-109', 'PRO-ATE-110') THEN replace(model, 'lung. ', 'L ') || ' mm'
  END AS new_model,
  now() AS prepared_at
FROM public.inventory
WHERE deleted_at IS NULL AND code IN ('COP-KAL-452', 'COP-KAL-453', 'COP-KAL-454', 'COP-NUL-023', 'PRO-ATE-108', 'PRO-ATE-109', 'PRO-ATE-110');

UPDATE public.inventory i SET model = l.new_model
FROM public.variant_cleanup_log_uniformita2_20261042 l
WHERE i.id = l.id AND i.model IS NOT DISTINCT FROM l.old_model;

UPDATE public.item_types SET variant_template = jsonb_set(variant_template, '{pattern}',
  '"[ø {diametro}] [sp.{spessore}] [L {lunghezza} mm] [densità {densita} kg/m³] {altro}"'::jsonb) WHERE name = 'Coppella';
UPDATE public.item_types SET variant_template = jsonb_set(variant_template, '{subtypes,1,pattern}',
  '"{forma} {materiale} {colore} [base {base}] [L {lunghezza} mm] {altro}"'::jsonb)
WHERE name = 'Profilati' AND variant_template->'subtypes'->1->>'key' = 'controsoffitto';
