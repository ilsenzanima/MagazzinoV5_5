-- Schede varianti per Varie, Brick, Box, Guaina e Pressurizzatori (eseguita in produzione, approvata).
--  * Varie: sottotipi eccedenza di lavorazione, teli/carte/vetri a misura, tubi (diametro), altro; 54 articoli con valori strutturati
--  * Brick (dimensioni), Box e Guaina (modello/note), Pressurizzatori (dotazione); PRE-AFS-270 passa a "pressostato digitale"
--  * ripristino:
--      UPDATE public.inventory i SET model = l.old_model, variant_attributes = l.old_attributes
--      FROM public.variant_normalization_log_varie_schede_20261040 l WHERE i.id = l.id;
--      UPDATE public.item_types SET variant_template = NULL WHERE name IN ('Varie', 'Brick', 'Box', 'Guaina', 'Pressurizzatori');
UPDATE public.item_types SET variant_template = '{"version":2,"fields":[],"pattern":"","subtypeLabel":"Tipo di articolo","subtypes":[{"key":"eccedenza","label":"Eccedenza di lavorazione","pattern":"{materiale}","suggestedName":"Eccedenza di lavorazione","fields":[{"key":"materiale","label":"Materiale","kind":"choice","open":true,"options":["calcio silicato","cartongesso","coppella gesso e cartone","ferro","inerti","lana minerale","secchi vuoti","tubetti silicone"],"required":true}]},{"key":"dimensioni","label":"Teli, carte, vetri e pezzi a misura","pattern":"{larghezza}x{lunghezza} [sp.{spessore}] {altro}","fields":[{"key":"larghezza","label":"Larghezza","kind":"number","unit":"mm","required":true},{"key":"lunghezza","label":"Lunghezza","kind":"number","unit":"mm","required":true},{"key":"spessore","label":"Spessore","kind":"number","unit":"mm"},{"key":"altro","label":"Altro","kind":"text"}]},{"key":"diametro","label":"Tubi, fermatubo e coperture (diametro)","pattern":"ø {diametro} {altro}","fields":[{"key":"diametro","label":"Diametro","kind":"text","hint":"Es. 80 oppure 13/21","required":true},{"key":"altro","label":"Altro","kind":"text"}]},{"key":"altro","label":"Altro","pattern":"{descrizione}","fields":[{"key":"descrizione","label":"Descrizione","kind":"text","required":true}]}]}'::jsonb WHERE name = 'Varie' AND variant_template IS NULL;
UPDATE public.item_types SET variant_template = '{"version":2,"fields":[{"key":"dimensioni","label":"Dimensioni","kind":"text","hint":"Es. 200x120x60 mm"},{"key":"altro","label":"Altro (modello)","kind":"text"}],"pattern":"{dimensioni} {altro}"}'::jsonb WHERE name = 'Brick' AND variant_template IS NULL;
UPDATE public.item_types SET variant_template = '{"version":2,"fields":[{"key":"altro","label":"Modello / note","kind":"text"}],"pattern":"{altro}"}'::jsonb WHERE name IN ('Box', 'Guaina') AND variant_template IS NULL;
UPDATE public.item_types SET variant_template = '{"version":2,"fields":[{"key":"dotazione","label":"Dotazione","kind":"choice","open":true,"options":["pressostato digitale"]},{"key":"altro","label":"Altro (modello)","kind":"text"}],"pattern":"{dotazione} {altro}"}'::jsonb WHERE name = 'Pressurizzatori' AND variant_template IS NULL;

CREATE TABLE IF NOT EXISTS public.variant_normalization_log_varie_schede_20261040 AS
SELECT i.id, i.code, i.name, i.category, i.model AS old_model, i.variant_attributes AS old_attributes,
       v.new_model, v.attrs::jsonb AS new_attributes, now() AS prepared_at
FROM public.inventory i
JOIN (VALUES
('ART-00130','calcio silicato','{"_sottotipo":"eccedenza","materiale":"calcio silicato"}'),
('ART-00077','cartongesso','{"_sottotipo":"eccedenza","materiale":"cartongesso"}'),
('ART-00195','coppella gesso e cartone','{"_sottotipo":"eccedenza","materiale":"coppella gesso e cartone"}'),
('ART-00076','ferro','{"_sottotipo":"eccedenza","materiale":"ferro"}'),
('ART-00226','inerti','{"_sottotipo":"eccedenza","materiale":"inerti"}'),
('ART-00194','lana minerale','{"_sottotipo":"eccedenza","materiale":"lana minerale"}'),
('ART-00212','secchi vuoti','{"_sottotipo":"eccedenza","materiale":"secchi vuoti"}'),
('ART-00120','tubetti silicone','{"_sottotipo":"eccedenza","materiale":"tubetti silicone"}'),
('VAR-NUL-294','100x20000','{"_sottotipo":"dimensioni","larghezza":"100","lunghezza":"20000"}'),
('VAR-NUL-295','180x20000','{"_sottotipo":"dimensioni","larghezza":"180","lunghezza":"20000"}'),
('VAR-NUL-296','300x20000','{"_sottotipo":"dimensioni","larghezza":"300","lunghezza":"20000"}'),
('ART-00098','4000x25000','{"_sottotipo":"dimensioni","larghezza":"4000","lunghezza":"25000"}'),
('VAR-NUL-292','4000x4000','{"_sottotipo":"dimensioni","larghezza":"4000","lunghezza":"4000"}'),
('VAR-SER-448','255x1180','{"_sottotipo":"dimensioni","larghezza":"255","lunghezza":"1180"}'),
('VAR-SER-450','255x845','{"_sottotipo":"dimensioni","larghezza":"255","lunghezza":"845"}'),
('VAR-SER-449','670x1180','{"_sottotipo":"dimensioni","larghezza":"670","lunghezza":"1180"}'),
('VAR-SER-451','670x845','{"_sottotipo":"dimensioni","larghezza":"670","lunghezza":"845"}'),
('VAR-SAC-375','620x6000','{"_sottotipo":"dimensioni","larghezza":"620","lunghezza":"6000"}'),
('VAR-KLO-246','1500x50000','{"_sottotipo":"dimensioni","larghezza":"1500","lunghezza":"50000"}'),
('ART-00225','120x1500','{"_sottotipo":"dimensioni","larghezza":"120","lunghezza":"1500"}'),
('ART-00060','7,8x540','{"_sottotipo":"dimensioni","larghezza":"7,8","lunghezza":"540"}'),
('ART-00069','7,8x750','{"_sottotipo":"dimensioni","larghezza":"7,8","lunghezza":"750"}'),
('ART-00070','125x2000','{"_sottotipo":"dimensioni","larghezza":"125","lunghezza":"2000"}'),
('VAR-POL-142','595x1195 sp.40 baffles','{"_sottotipo":"dimensioni","larghezza":"595","lunghezza":"1195","spessore":"40","altro":"baffles"}'),
('VAR-POL-143','595x1195 sp.40 magnetico','{"_sottotipo":"dimensioni","larghezza":"595","lunghezza":"1195","spessore":"40","altro":"magnetico"}'),
('VAR-WUR-462','ø 13/21','{"_sottotipo":"diametro","diametro":"13/21"}'),
('VAR-WUR-461','ø 38/50','{"_sottotipo":"diametro","diametro":"38/50"}'),
('VAR-WUR-463','ø 50','{"_sottotipo":"diametro","diametro":"50"}'),
('VAR-NUL-315','ø 80','{"_sottotipo":"diametro","diametro":"80"}'),
('ART-00119','FIX2 Turbo GT','{"_sottotipo":"altro","descrizione":"FIX2 Turbo GT"}'),
('ART-00086','WIT-PM 200','{"_sottotipo":"altro","descrizione":"WIT-PM 200"}'),
('COL-WUR-332','WIT-VM 250','{"_sottotipo":"altro","descrizione":"WIT-VM 250"}'),
('VAR-WUR-486','13 mm lunga','{"_sottotipo":"altro","descrizione":"13 mm lunga"}'),
('VAR-CAS-495','vari','{"_sottotipo":"altro","descrizione":"vari"}'),
('VAR-NUL-432','"PUNTO DI RACCOLTA"','{"_sottotipo":"altro","descrizione":"\"PUNTO DI RACCOLTA\""}'),
('ART-00088','liquido','{"_sottotipo":"altro","descrizione":"liquido"}'),
('ART-00089','pasta','{"_sottotipo":"altro","descrizione":"pasta"}'),
('ART-00164','nitro 5 L','{"_sottotipo":"altro","descrizione":"nitro 5 L"}'),
('ART-00159','foro rombo 43x13 mm','{"_sottotipo":"altro","descrizione":"foro rombo 43x13 mm"}'),
('VAR-NUL-330','pedonabile','{"_sottotipo":"altro","descrizione":"pedonabile"}'),
('VAR-STI-406','80x600x1200','{"_sottotipo":"altro","descrizione":"80x600x1200"}'),
('VAR-WUR-139','standard','{"_sottotipo":"altro","descrizione":"standard"}'),
('VAR-BEG-361','18 W autonomia 1 ora','{"_sottotipo":"altro","descrizione":"18 W autonomia 1 ora"}'),
('VAR-BEG-360','24 W autonomia 1 ora','{"_sottotipo":"altro","descrizione":"24 W autonomia 1 ora"}'),
('ART-00224','250x120x55','{"_sottotipo":"altro","descrizione":"250x120x55"}'),
('VAR-NUL-331','12x12 H100','{"_sottotipo":"altro","descrizione":"12x12 H100"}'),
('VAR-TYT-369','per cartongesso','{"_sottotipo":"altro","descrizione":"per cartongesso"}'),
('ART-00131','rettangolare 800x250 manuale','{"_sottotipo":"altro","descrizione":"rettangolare 800x250 manuale"}'),
('ART-00152','AzzurraBluSky sp.0,12','{"_sottotipo":"altro","descrizione":"AzzurraBluSky sp.0,12"}'),
('ART-00196','fogli nero 0,20 ml 4 rigenerato 50 kg 260 mq','{"_sottotipo":"altro","descrizione":"fogli nero 0,20 ml 4 rigenerato 50 kg 260 mq"}'),
('ART-00072','diametro interno 127 mm','{"_sottotipo":"altro","descrizione":"diametro interno 127 mm"}'),
('VAR-ROC-141','bianco 4FR','{"_sottotipo":"altro","descrizione":"bianco 4FR"}'),
('BRI-PRO-009','200x120x60','{"dimensioni":"200x120x60"}'),
('PRE-AFS-270','pressostato digitale','{"dotazione":"pressostato digitale"}')
) AS v(code, new_model, attrs) ON i.code = v.code
WHERE i.deleted_at IS NULL AND i.category IN ('Varie', 'Brick', 'Pressurizzatori');

UPDATE public.inventory i
SET model = p.new_model, variant_attributes = p.new_attributes
FROM public.variant_normalization_log_varie_schede_20261040 p
WHERE i.id = p.id AND (i.model IS NOT DISTINCT FROM p.old_model);
