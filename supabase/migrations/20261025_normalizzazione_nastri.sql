-- Normalizzazione dei Nastri esistenti secondo la scheda varianti (eseguita in produzione, approvata riga per riga).
--  * scheda Nastri: aggiunto il tipo "isolante"
--  * 20 nastri con variante: testo nel formato della scheda + valori strutturati; 9 testi cambiano
--  * senza variante restano Banda armata, Garza adesiva, Nastro in fibra di vetro (coefficiente 25 invariato), Nastro microforato
--  * ripristino:
--      UPDATE public.inventory i SET model = l.old_model, variant_attributes = l.old_attributes
--      FROM public.variant_normalization_log_nastri_20261025 l WHERE i.id = l.id;
UPDATE public.item_types
SET variant_template = jsonb_set(variant_template, '{fields,2,options}', (variant_template->'fields'->2->'options') || '["isolante"]'::jsonb)
WHERE name = 'Nastri' AND variant_template->'fields'->2->>'key' = 'tipo'
  AND NOT (variant_template->'fields'->2->'options') ? 'isolante';

CREATE TABLE IF NOT EXISTS public.variant_normalization_log_nastri_20261025 AS
SELECT i.id, i.code, i.name, i.model AS old_model, i.variant_attributes AS old_attributes,
       v.new_model, v.attrs::jsonb AS new_attributes, now() AS prepared_at
FROM public.inventory i
JOIN (VALUES
('NAS-TES-282','25x5000 mascheratura','{"larghezza":"25","lunghezza":"5000","tipo":"mascheratura"}'),
('NAS-TES-300','30x5000 carta','{"larghezza":"30","lunghezza":"5000","tipo":"carta"}'),
('ART-00032','38x50000 carta','{"larghezza":"38","lunghezza":"50000","tipo":"carta"}'),
('ART-00016','38x50000 mascheratura','{"larghezza":"38","lunghezza":"50000","tipo":"mascheratura"}'),
('NAS-NUL-455','50x15000 gommato','{"larghezza":"50","lunghezza":"15000","tipo":"gommato"}'),
('NAS-TES-284','50x15000 imballo','{"larghezza":"50","lunghezza":"15000","tipo":"imballo"}'),
('NAS-WUR-308','50x5000 alluminio','{"larghezza":"50","lunghezza":"5000","tipo":"alluminio"}'),
('NAS-NUL-135','50x5000 alluminio','{"larghezza":"50","lunghezza":"5000","tipo":"alluminio"}'),
('NAS-TES-283','50x5000 mascheratura','{"larghezza":"50","lunghezza":"5000","tipo":"mascheratura"}'),
('NAS-TES-299','50x5000 mascheratura blu','{"larghezza":"50","lunghezza":"5000","tipo":"mascheratura","altro":"blu"}'),
('ART-00027','50x50000 carta','{"larghezza":"50","lunghezza":"50000","tipo":"carta"}'),
('ART-00066','Americano telato','{"altro":"Americano telato"}'),
('ART-00071','imballo trasparente','{"tipo":"imballo","altro":"trasparente"}'),
('ART-00102','25x19000 isolante nero','{"larghezza":"25","lunghezza":"19000","tipo":"isolante","altro":"nero"}'),
('NAS-AFS-346','AF Fireguard 3','{"altro":"AF Fireguard 3"}'),
('ART-00099','2600x17000 protettivo trasparente','{"larghezza":"2600","lunghezza":"17000","tipo":"protettivo","altro":"trasparente"}'),
('NAS-AKI-130','50 mm','{"larghezza":"50"}'),
('NAS-AKI-131','70 mm','{"larghezza":"70"}'),
('NAS-AKI-132','50 mm','{"larghezza":"50"}'),
('NAS-AKI-133','70 mm','{"larghezza":"70"}')
) AS v(code, new_model, attrs) ON i.code = v.code
WHERE i.deleted_at IS NULL AND i.category = 'Nastri';

UPDATE public.inventory i
SET model = p.new_model, variant_attributes = p.new_attributes
FROM public.variant_normalization_log_nastri_20261025 p
WHERE i.id = p.id AND i.model IS NOT DISTINCT FROM p.old_model;
