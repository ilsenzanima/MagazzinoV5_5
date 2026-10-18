-- Viti: diametri verificati dall'utente (eseguita in produzione)
--  * VIT-FRI-163: 48 -> 4,8 (e "torks" -> "torx")
--  * VIT-WUR-159 e VIT-WUR-161: 50 -> 5,0
--  * ripristino:
--      UPDATE public.inventory i SET model = l.old_model, variant_attributes = l.old_attributes
--      FROM public.variant_normalization_log_viti2_20261043 l WHERE i.id = l.id;
CREATE TABLE IF NOT EXISTS public.variant_normalization_log_viti2_20261043 AS
SELECT i.id, i.code, i.name, i.model AS old_model, i.variant_attributes AS old_attributes,
       v.new_model, v.attrs::jsonb AS new_attributes, now() AS prepared_at
FROM public.inventory i
JOIN (VALUES
('VIT-FRI-163','4,8x45 punta trapano testa torx','{"diametro":"4,8","lunghezza":"45","punta":"punta trapano","testa":"testa torx"}'),
('VIT-WUR-159','5,0x100/52','{"diametro":"5,0","lunghezza":"100","filetto":"52"}'),
('VIT-WUR-161','5,0x60/54','{"diametro":"5,0","lunghezza":"60","filetto":"54"}')
) AS v(code, new_model, attrs) ON i.code = v.code
WHERE i.deleted_at IS NULL AND i.category = 'Viti';

UPDATE public.inventory i
SET model = p.new_model, variant_attributes = p.new_attributes
FROM public.variant_normalization_log_viti2_20261043 p
WHERE i.id = p.id AND i.model IS NOT DISTINCT FROM p.old_model;
