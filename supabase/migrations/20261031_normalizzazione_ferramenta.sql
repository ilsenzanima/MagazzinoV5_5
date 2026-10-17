-- Normalizzazione della Ferramenta esistente secondo la scheda varianti (eseguita in produzione, approvata riga per riga).
--  * 63 articoli: testo nel formato della scheda + valori strutturati (con _sottotipo)
--  * senza variante restano 11 articoli (Angolare VARIFIX/laminato, molle, ganci, filotreccia, rondelle senza misura, staffa)
--  * ripristino:
--      UPDATE public.inventory i SET model = l.old_model, variant_attributes = l.old_attributes
--      FROM public.variant_normalization_log_ferramenta_20261031 l WHERE i.id = l.id;
CREATE TABLE IF NOT EXISTS public.variant_normalization_log_ferramenta_20261031 AS
SELECT i.id, i.code, i.name, i.model AS old_model, i.variant_attributes AS old_attributes,
       v.new_model, v.attrs::jsonb AS new_attributes, now() AS prepared_at
FROM public.inventory i
JOIN (VALUES
('FER-WUR-055','M6','{"_sottotipo":"viteria","diametro":"M6"}'),
('FER-HIL-259','M10x1000 HDG HAS 8.8','{"_sottotipo":"viteria","diametro":"M10","lunghezza":"1000","finitura":"HDG","altro":"HAS 8.8"}'),
('FER-WUR-256','M10x1000','{"_sottotipo":"viteria","diametro":"M10","lunghezza":"1000"}'),
('ART-00135','M10x1000','{"_sottotipo":"viteria","diametro":"M10","lunghezza":"1000"}'),
('ART-00093','M12x1000','{"_sottotipo":"viteria","diametro":"M12","lunghezza":"1000"}'),
('FER-WUR-336','M16x1000','{"_sottotipo":"viteria","diametro":"M16","lunghezza":"1000"}'),
('ART-00047','M5x1000','{"_sottotipo":"viteria","diametro":"M5","lunghezza":"1000"}'),
('FER-NUL-036','M8x1000','{"_sottotipo":"viteria","diametro":"M8","lunghezza":"1000"}'),
('FER-NUL-037','M8x1500','{"_sottotipo":"viteria","diametro":"M8","lunghezza":"1500"}'),
('ART-00063','M8x3000','{"_sottotipo":"viteria","diametro":"M8","lunghezza":"3000"}'),
('FER-NUL-261','M10','{"_sottotipo":"viteria","diametro":"M10"}'),
('ART-00094','M12','{"_sottotipo":"viteria","diametro":"M12"}'),
('FER-WUR-335','M16','{"_sottotipo":"viteria","diametro":"M16"}'),
('ATT-WUR-477','M8','{"_sottotipo":"viteria","diametro":"M8"}'),
('FER-WUR-051','M10','{"_sottotipo":"viteria","diametro":"M10"}'),
('FER-WUR-052','M10','{"_sottotipo":"viteria","diametro":"M10"}'),
('ART-00091','M12','{"_sottotipo":"viteria","diametro":"M12"}'),
('FER-WUR-333','M16','{"_sottotipo":"viteria","diametro":"M16"}'),
('ART-00049','M5','{"_sottotipo":"viteria","diametro":"M5"}'),
('ART-00065','M8','{"_sottotipo":"viteria","diametro":"M8"}'),
('ART-00133','10','{"_sottotipo":"viteria","diametro":"10"}'),
('FER-WUR-053','10,5','{"_sottotipo":"viteria","diametro":"10,5"}'),
('ART-00136','10,5 30x2,5','{"_sottotipo":"viteria","diametro":"10,5","dimensioni":"30x2,5"}'),
('ART-00090','13','{"_sottotipo":"viteria","diametro":"13"}'),
('ART-00048','6,4 24x2,0','{"_sottotipo":"viteria","diametro":"6,4","dimensioni":"24x2,0"}'),
('FER-WUR-054','8,4 30x2,5','{"_sottotipo":"viteria","diametro":"8,4","dimensioni":"30x2,5"}'),
('ART-00064','8,4 30x1,5','{"_sottotipo":"viteria","diametro":"8,4","dimensioni":"30x1,5"}'),
('ART-00122','8,4 inox','{"_sottotipo":"viteria","diametro":"8,4","finitura":"inox"}'),
('FER-WUR-334','M16','{"_sottotipo":"viteria","diametro":"M16"}'),
('FER-WUR-372','M10','{"_sottotipo":"viteria","diametro":"M10"}'),
('ART-00055','M8 inox A2K DIN 1480','{"_sottotipo":"viteria","diametro":"M8","finitura":"inox A2K","altro":"DIN 1480"}'),
('FER-NUL-039','1000 gancio','{"_sottotipo":"pendini","lunghezza":"1000","terminale":"gancio"}'),
('FER-NUL-040','250 gancio','{"_sottotipo":"pendini","lunghezza":"250","terminale":"gancio"}'),
('FER-NUL-041','500 gancio','{"_sottotipo":"pendini","lunghezza":"500","terminale":"gancio"}'),
('FER-NUL-042','1000 occhiolo','{"_sottotipo":"pendini","lunghezza":"1000","terminale":"occhiolo"}'),
('FER-NUL-043','1000 occhiolo a 90°','{"_sottotipo":"pendini","lunghezza":"1000","terminale":"occhiolo a 90°"}'),
('FER-NUL-045','2000 occhiolo a 90°','{"_sottotipo":"pendini","lunghezza":"2000","terminale":"occhiolo a 90°"}'),
('FER-NUL-044','250 occhiolo a 90°','{"_sottotipo":"pendini","lunghezza":"250","terminale":"occhiolo a 90°"}'),
('FER-WUR-481','36x36x2,5x2000','{"_sottotipo":"profili","sezione":"36x36x2,5","lunghezza":"2000"}'),
('ART-00040','26x18x1,25x2000','{"_sottotipo":"profili","sezione":"26x18x1,25","lunghezza":"2000"}'),
('FER-WUR-257','41x22x2,5x2000','{"_sottotipo":"profili","sezione":"41x22x2,5","lunghezza":"2000"}'),
('FER-FER-365','50x50','{"_sottotipo":"profili","sezione":"50x50"}'),
('FER-NUL-038','49x27','{"_sottotipo":"profili","sezione":"49x27"}'),
('FER-MET-046','60x35','{"_sottotipo":"profili","sezione":"60x35"}'),
('FER-FER-364','100x100','{"_sottotipo":"profili","sezione":"100x100"}'),
('FER-FER-430','150x50x3x6000','{"_sottotipo":"profili","sezione":"150x50x3","lunghezza":"6000"}'),
('FER-NUL-431','ø 48x3000','{"_sottotipo":"profili","sezione":"ø 48","lunghezza":"3000"}'),
('FER-WUR-047','1000','{"_sottotipo":"altro","descrizione":"1000"}'),
('FER-WUR-048','1200','{"_sottotipo":"altro","descrizione":"1200"}'),
('FER-WUR-049','3000','{"_sottotipo":"altro","descrizione":"3000"}'),
('ART-00053','4,0 mm x 50 m','{"_sottotipo":"altro","descrizione":"4,0 mm x 50 m"}'),
('FER-AKI-029','alto foro ø 6','{"_sottotipo":"altro","descrizione":"alto foro ø 6"}'),
('FER-AKI-030','alto foro filettato M6','{"_sottotipo":"altro","descrizione":"alto foro filettato M6"}'),
('FER-AKI-027','basso foro ø 6','{"_sottotipo":"altro","descrizione":"basso foro ø 6"}'),
('FER-AKI-028','basso foro filettato M6','{"_sottotipo":"altro","descrizione":"basso foro filettato M6"}'),
('FER-NUL-435','misure varie','{"_sottotipo":"altro","descrizione":"misure varie"}'),
('FER-NUL-433','ø 48','{"_sottotipo":"altro","descrizione":"ø 48"}'),
('ART-00062','per barre asolate','{"_sottotipo":"altro","descrizione":"per barre asolate"}'),
('ART-00198','in bobine 5x2 1,0 mm 25 kg','{"_sottotipo":"altro","descrizione":"in bobine 5x2 1,0 mm 25 kg"}'),
('ART-00213','in profilo CFP 200 dim. 250x800','{"_sottotipo":"altro","descrizione":"in profilo CFP 200 dim. 250x800"}'),
('ART-00054','MIS.0,16-D6','{"_sottotipo":"altro","descrizione":"MIS.0,16-D6"}'),
('FER-HIL-258','MQK-41/3/600','{"_sottotipo":"altro","descrizione":"MQK-41/3/600"}'),
('ART-00059','testa esagonale','{"_sottotipo":"altro","descrizione":"testa esagonale"}')
) AS v(code, new_model, attrs) ON i.code = v.code
WHERE i.deleted_at IS NULL AND i.category = 'Ferramenta';

UPDATE public.inventory i
SET model = p.new_model, variant_attributes = p.new_attributes
FROM public.variant_normalization_log_ferramenta_20261031 p
WHERE i.id = p.id AND i.model IS NOT DISTINCT FROM p.old_model;
