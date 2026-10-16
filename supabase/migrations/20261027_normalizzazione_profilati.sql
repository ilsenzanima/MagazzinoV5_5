-- Normalizzazione dei Profilati esistenti secondo la scheda varianti (eseguita in produzione, approvata riga per riga).
--  * scheda Profilati, "Profili controsoffitto": aggiunto il campo "Altro" (es. misure 35x35x3000)
--  * 20 articoli: testo nel formato della scheda + valori strutturati (con _sottotipo); 13 testi cambiano
--  * ripristino:
--      UPDATE public.inventory i SET model = l.old_model, variant_attributes = l.old_attributes
--      FROM public.variant_normalization_log_profilati_20261027 l WHERE i.id = l.id;
UPDATE public.item_types SET variant_template = jsonb_set(jsonb_set(variant_template,
  '{subtypes,1,fields}', (variant_template->'subtypes'->1->'fields') || '[{"key":"altro","kind":"text","label":"Altro"}]'::jsonb),
  '{subtypes,1,pattern}', '"{forma} {materiale} {colore} [base {base}] [lung. {lunghezza}] {altro}"'::jsonb)
WHERE name = 'Profilati' AND variant_template->'subtypes'->1->>'key' = 'controsoffitto'
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(variant_template->'subtypes'->1->'fields') f WHERE f->>'key' = 'altro');

CREATE TABLE IF NOT EXISTS public.variant_normalization_log_profilati_20261027 AS
SELECT i.id, i.code, i.name, i.model AS old_model, i.variant_attributes AS old_attributes,
       v.new_model, v.attrs::jsonb AS new_attributes, now() AS prepared_at
FROM public.inventory i
JOIN (VALUES
('PRO-ATE-105','15x30x3000','{"_sottotipo":"paraspigoli","larghezza":"15","ala":"30","lunghezza":"3000"}'),
('PRO-ATE-106','15x30x3000','{"_sottotipo":"paraspigoli","larghezza":"15","ala":"30","lunghezza":"3000"}'),
('PRO-ATE-107','30x30x3000','{"_sottotipo":"paraspigoli","larghezza":"30","ala":"30","lunghezza":"3000"}'),
('PRO-NUL-113','alluminio 30x30x2500','{"_sottotipo":"paraspigoli","materiale":"alluminio","larghezza":"30","ala":"30","lunghezza":"2500"}'),
('ART-00117','Inox','{"_sottotipo":"lamiere","materiale":"inox"}'),
('PRO-ATE-108','T lung. 1200','{"_sottotipo":"controsoffitto","forma":"T","lunghezza":"1200"}'),
('PRO-ATE-109','T lung. 3700','{"_sottotipo":"controsoffitto","forma":"T","lunghezza":"3700"}'),
('PRO-ATE-110','T lung. 600','{"_sottotipo":"controsoffitto","forma":"T","lunghezza":"600"}'),
('PRO-ATE-111','W bianco','{"_sottotipo":"controsoffitto","forma":"W","colore":"bianco"}'),
('PRO-ATE-112','W grigio','{"_sottotipo":"controsoffitto","forma":"W","colore":"grigio"}'),
('ART-00141','L acciaio bianco','{"_sottotipo":"controsoffitto","forma":"L","materiale":"acciaio","colore":"bianco"}'),
('PRO-ATE-103','F','{"_sottotipo":"controsoffitto","forma":"F"}'),
('PRO-ATE-104','L bianco','{"_sottotipo":"controsoffitto","forma":"L","colore":"bianco"}'),
('ART-00096','L grigio','{"_sottotipo":"controsoffitto","forma":"L","colore":"grigio"}'),
('PRO-OFF-265','L lamiera zincata','{"_sottotipo":"controsoffitto","forma":"L","materiale":"lamiera zincata"}'),
('ART-00147','L lamiera zincata 35x35x3000','{"_sottotipo":"controsoffitto","forma":"L","materiale":"lamiera zincata","altro":"35x35x3000"}'),
('ART-00154','lamiera zincata 8/10','{"_sottotipo":"lamiere","materiale":"lamiera zincata","spessore":"8/10"}'),
('PRO-OFF-467','inox A/304 8/10','{"_sottotipo":"lamiere","materiale":"inox A/304","spessore":"8/10"}'),
('ART-00044','inox A/304 6/10','{"_sottotipo":"lamiere","materiale":"inox A/304","spessore":"6/10"}'),
('ART-00045','preverniciata 6/10 bianco puro','{"_sottotipo":"lamiere","materiale":"preverniciata","spessore":"6/10","colore":"bianco puro"}')
) AS v(code, new_model, attrs) ON i.code = v.code
WHERE i.deleted_at IS NULL AND i.category = 'Profilati';

UPDATE public.inventory i
SET model = p.new_model, variant_attributes = p.new_attributes
FROM public.variant_normalization_log_profilati_20261027 p
WHERE i.id = p.id AND i.model IS NOT DISTINCT FROM p.old_model;
