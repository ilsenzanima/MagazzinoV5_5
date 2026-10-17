-- Normalizzazione delle Viti esistenti secondo la scheda varianti (eseguita in produzione, approvata riga per riga).
--  * scheda Viti: aggiunto il campo "Lunghezza filetto" (sigle tipo 4,5x70/64)
--  * 45 viti: testo variante nel formato della scheda + valori strutturati in variant_attributes
--  * restano fuori 3 articoli con diametro da verificare: VIT-FRI-163, VIT-WUR-159, VIT-WUR-161
--  * ripristino:
--      UPDATE public.inventory i SET model = l.old_model, variant_attributes = l.old_attributes
--      FROM public.variant_normalization_log_viti_20261022 l WHERE i.id = l.id;
UPDATE public.item_types SET variant_template = jsonb_set(
  jsonb_set(variant_template, '{pattern}', '"[{diametro}x{lunghezza}|{lunghezza} mm][/{filetto}] {punta} {testa} {finitura} {altro}"'::jsonb),
  '{fields}', (variant_template->'fields') || '[{"key":"filetto","label":"Lunghezza filetto","kind":"number","unit":"mm","hint":"Per le sigle tipo 4,5x70/64"}]'::jsonb)
WHERE name = 'Viti' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(variant_template->'fields') f WHERE f->>'key' = 'filetto');

CREATE TABLE IF NOT EXISTS public.variant_normalization_log_viti_20261022 AS
SELECT i.id, i.code, i.name, i.model AS old_model, i.variant_attributes AS old_attributes,
       v.new_model, v.attrs::jsonb AS new_attributes, now() AS prepared_at
FROM public.inventory i
JOIN (VALUES
('VIT-FRI-168','6,3x140 punta trapano testa esagonale','{"diametro":"6,3","lunghezza":"140","punta":"punta trapano","testa":"testa esagonale"}'),
('VIT-FRI-169','6,3x19 punta trapano testa esagonale','{"diametro":"6,3","lunghezza":"19","punta":"punta trapano","testa":"testa esagonale"}'),
('VIT-FRI-170','6,3x32 punta trapano testa esagonale','{"diametro":"6,3","lunghezza":"32","punta":"punta trapano","testa":"testa esagonale"}'),
('VIT-FRI-164','6,3x38 punta chiodo testa esagonale','{"diametro":"6,3","lunghezza":"38","punta":"punta chiodo","testa":"testa esagonale"}'),
('VIT-FRI-171','6,3x45 punta trapano testa esagonale','{"diametro":"6,3","lunghezza":"45","punta":"punta trapano","testa":"testa esagonale"}'),
('VIT-FRI-165','6,3x50 punta chiodo testa esagonale','{"diametro":"6,3","lunghezza":"50","punta":"punta chiodo","testa":"testa esagonale"}'),
('VIT-FRI-173','6,3x60 punta trapano testa esagonale','{"diametro":"6,3","lunghezza":"60","punta":"punta trapano","testa":"testa esagonale"}'),
('VIT-FRI-166','6,3x80 punta chiodo testa esagonale','{"diametro":"6,3","lunghezza":"80","punta":"punta chiodo","testa":"testa esagonale"}'),
('VIT-FRI-162','6,3x80 punta trapano testa esagonale','{"diametro":"6,3","lunghezza":"80","punta":"punta trapano","testa":"testa esagonale"}'),
('VIT-FRI-167','6,3x90 punta chiodo testa esagonale','{"diametro":"6,3","lunghezza":"90","punta":"punta chiodo","testa":"testa esagonale"}'),
('VIT-WUR-311','TX30-5-6X40','{"altro":"TX30-5-6X40"}'),
('ART-00221','M8x140','{"diametro":"M8","lunghezza":"140"}'),
('ART-00134','M8x20','{"diametro":"M8","lunghezza":"20"}'),
('ART-00175','4,8x50','{"diametro":"4,8","lunghezza":"50"}'),
('ART-00015','4,2x25 testa bombata','{"diametro":"4,2","lunghezza":"25","testa":"testa bombata"}'),
('VIT-----158','12,7 mm punta trapano','{"lunghezza":"12,7","punta":"punta trapano"}'),
('VIT-WUR-479','4x70 testa svasata piana','{"diametro":"4","lunghezza":"70","testa":"testa svasata piana"}'),
('ART-00104','5x50 testa svasata inox','{"diametro":"5","lunghezza":"50","testa":"testa svasata","finitura":"inox"}'),
('ART-00030','5x80 testa svasata piana','{"diametro":"5","lunghezza":"80","testa":"testa svasata piana"}'),
('ART-00028','6x140 testa svasata piana','{"diametro":"6","lunghezza":"140","testa":"testa svasata piana"}'),
('ART-00029','6x160 testa svasata piana','{"diametro":"6","lunghezza":"160","testa":"testa svasata piana"}'),
('ART-00050','6x60 testa svasata piana','{"diametro":"6","lunghezza":"60","testa":"testa svasata piana"}'),
('ART-00105','6x70 testa svasata inox','{"diametro":"6","lunghezza":"70","testa":"testa svasata","finitura":"inox"}'),
('VIT-----146','M5x90/50','{"diametro":"M5","lunghezza":"90","filetto":"50"}'),
('VIT-----151','100 mm','{"lunghezza":"100"}'),
('VIT-----280','110 mm','{"lunghezza":"110"}'),
('VIT-----145','130 mm','{"lunghezza":"130"}'),
('VIT-----345','150 mm','{"lunghezza":"150"}'),
('VIT-----144','19 mm','{"lunghezza":"19"}'),
('VIT-----148','25 mm','{"lunghezza":"25"}'),
('VIT-----153','25 mm per calcio silicato','{"lunghezza":"25","altro":"per calcio silicato"}'),
('VIT-MUL-379','25 mm punta trapano','{"lunghezza":"25","punta":"punta trapano"}'),
('VIT-----155','35 mm','{"lunghezza":"35"}'),
('VIT-MUL-378','35 mm punta trapano','{"lunghezza":"35","punta":"punta trapano"}'),
('VIT-----156','45 mm','{"lunghezza":"45"}'),
('ART-00146','45 mm per calcio silicato','{"lunghezza":"45","altro":"per calcio silicato"}'),
('VIT-----154','45 mm per pannelli Promat','{"lunghezza":"45","altro":"per pannelli Promat"}'),
('VIT-----149','55 mm','{"lunghezza":"55"}'),
('VIT-----152','55 mm punta trapano','{"lunghezza":"55","punta":"punta trapano"}'),
('VIT-----150','70 mm','{"lunghezza":"70"}'),
('VIT-----147','90 mm','{"lunghezza":"90"}'),
('VIT-WUR-310','3,5x40','{"diametro":"3,5","lunghezza":"40"}'),
('ART-00220','4x35','{"diametro":"4","lunghezza":"35"}'),
('VIT-MUL-443','6x100 testa torx','{"diametro":"6","lunghezza":"100","testa":"testa torx"}'),
('VIT-WUR-160','4,5x70/64','{"diametro":"4,5","lunghezza":"70","filetto":"64"}')
) AS v(code, new_model, attrs) ON i.code = v.code
WHERE i.deleted_at IS NULL AND i.category = 'Viti';

UPDATE public.inventory i
SET model = p.new_model, variant_attributes = p.new_attributes
FROM public.variant_normalization_log_viti_20261022 p
WHERE i.id = p.id AND i.model IS NOT DISTINCT FROM p.old_model;
