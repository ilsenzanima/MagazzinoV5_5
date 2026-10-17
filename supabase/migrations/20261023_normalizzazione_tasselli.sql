-- Normalizzazione dei Tasselli esistenti secondo la scheda varianti (eseguita in produzione, approvata riga per riga).
--  * scheda Tasselli: con solo il diametro la variante si scrive "ø 14"
--  * 36 tasselli con variante: testo nel formato della scheda + valori strutturati; 10 testi cambiano
--  * senza variante restano Chiodini con rondella e Tassello a ignezione
--  * ripristino:
--      UPDATE public.inventory i SET model = l.old_model, variant_attributes = l.old_attributes
--      FROM public.variant_normalization_log_tasselli_20261023 l WHERE i.id = l.id;
UPDATE public.item_types SET variant_template = jsonb_set(variant_template, '{pattern}', '"[{diametro}x{lunghezza}|ø {diametro}] {dotazione} {altro}"'::jsonb) WHERE name = 'Tasselli';

CREATE TABLE IF NOT EXISTS public.variant_normalization_log_tasselli_20261023 AS
SELECT i.id, i.code, i.name, i.model AS old_model, i.variant_attributes AS old_attributes,
       v.new_model, v.attrs::jsonb AS new_attributes, now() AS prepared_at
FROM public.inventory i
JOIN (VALUES
('TAS-HIL-185','ø 8','{"diametro":"8"}'),
('ART-00052','con vite ad occhiolo dado e rondella WSL','{"dotazione":"con vite ad occhiolo","altro":"dado e rondella WSL"}'),
('TAS-AKI-181','ø 14 con vite','{"diametro":"14","dotazione":"con vite"}'),
('TAS-AKI-182','ø 15 con occhiolo','{"diametro":"15","dotazione":"con occhiolo"}'),
('TAS-AKI-183','ø 15 con vite','{"diametro":"15","dotazione":"con vite"}'),
('ART-00085','20x85','{"diametro":"20","lunghezza":"85"}'),
('TAS-FIS-195','12/50','{"altro":"12/50"}'),
('TAS-HIL-260','M12x100/20','{"altro":"M12x100/20"}'),
('TAS-WUR-401','6x30 con vite','{"diametro":"6","lunghezza":"30","dotazione":"con vite"}'),
('TAS-WUR-483','8x100','{"diametro":"8","lunghezza":"100"}'),
('TAS-WUR-281','8x120','{"diametro":"8","lunghezza":"120"}'),
('TAS-WUR-381','8x140','{"diametro":"8","lunghezza":"140"}'),
('TAS-WUR-341','8x60','{"diametro":"8","lunghezza":"60"}'),
('TAS-WUR-482','8x80','{"diametro":"8","lunghezza":"80"}'),
('TAS-AKI-175','5x25','{"diametro":"5","lunghezza":"25"}'),
('TAS-AKI-176','6x38','{"diametro":"6","lunghezza":"38"}'),
('TAS-AKI-177','6x38 barattolo','{"diametro":"6","lunghezza":"38","altro":"barattolo"}'),
('TAS-AKI-178','6x60','{"diametro":"6","lunghezza":"60"}'),
('TAS-WUR-193','14,5x33','{"diametro":"14,5","lunghezza":"33"}'),
('TAS-AKI-180','9x40','{"diametro":"9","lunghezza":"40"}'),
('TAS-WUR-191','M12-10-25/105','{"altro":"M12-10-25/105"}'),
('ART-00148','SBS 9/4 c/vite','{"altro":"SBS 9/4 c/vite"}'),
('TAS-AKI-184','9x60','{"diametro":"9","lunghezza":"60"}'),
('ART-00180','9x90','{"diametro":"9","lunghezza":"90"}'),
('TAS-AKI-174','9x80','{"diametro":"9","lunghezza":"80"}'),
('TAS-WUR-189','M10-12x35','{"altro":"M10-12x35"}'),
('ART-00084','M12-15x40','{"altro":"M12-15x40"}'),
('TAS-FRI-196','M8-10x28','{"altro":"M8-10x28"}'),
('TAS-WUR-188','13-16','{"altro":"13-16"}'),
('TAS-WUR-190','6x35','{"diametro":"6","lunghezza":"35"}'),
('TAS-WUR-192','6x35 senza vite','{"diametro":"6","lunghezza":"35","dotazione":"senza vite"}'),
('TAS-D.B-187','6x60 con occhiolo','{"diametro":"6","lunghezza":"60","dotazione":"con occhiolo"}'),
('ART-00051','10x56','{"diametro":"10","lunghezza":"56"}'),
('TAS-WUR-484','8x110','{"diametro":"8","lunghezza":"110"}'),
('TAS-WUR-194','M6x40','{"diametro":"M6","lunghezza":"40"}'),
('TAS-AKI-179','M6x40 acciaio','{"diametro":"M6","lunghezza":"40","altro":"acciaio"}')
) AS v(code, new_model, attrs) ON i.code = v.code
WHERE i.deleted_at IS NULL AND i.category = 'Tasselli';

UPDATE public.inventory i
SET model = p.new_model, variant_attributes = p.new_attributes
FROM public.variant_normalization_log_tasselli_20261023 p
WHERE i.id = p.id AND i.model IS NOT DISTINCT FROM p.old_model;
