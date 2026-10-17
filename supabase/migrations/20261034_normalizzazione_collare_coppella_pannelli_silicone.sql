-- Normalizzazione di Collare, Coppella, Pannelli e Silicone secondo le schede varianti (eseguita in produzione, approvata riga per riga).
--  * 34 articoli: testo nel formato della scheda + valori strutturati
--  * senza variante restano gli articoli senza dati nel testo (7 Collare, 1 Pannello, 7 Silicone)
--  * ripristino:
--      UPDATE public.inventory i SET model = l.old_model, variant_attributes = l.old_attributes
--      FROM public.variant_normalization_log_collare_coppella_pannelli_silicone_20261034 l WHERE i.id = l.id;
CREATE TABLE IF NOT EXISTS public.variant_normalization_log_collare_coppella_pannelli_silicone_20261034 AS
SELECT i.id, i.code, i.name, i.category, i.model AS old_model, i.variant_attributes AS old_attributes,
       v.new_model, v.attrs::jsonb AS new_attributes, now() AS prepared_at
FROM public.inventory i
JOIN (VALUES
('COL-AFS-010','Diametro 160','{"diametro":"160"}'),
('COL-AFS-011','Diametro 250','{"diametro":"250"}'),
('COL-AFS-012','Diametro 315','{"diametro":"315"}'),
('COL-AFS-013','Diametro 250','{"diametro":"250"}'),
('COL-PRO-460','Diametro 125','{"diametro":"125"}'),
('COL-PRO-019','Diametro 110','{"diametro":"110"}'),
('COL-INT-021','Diametro 110','{"diametro":"110"}'),
('COL-INT-022','Diametro 75','{"diametro":"75"}'),
('COL-GLO-424','40x3000','{"altro":"40x3000"}'),
('COP-KAL-025','ST-I 19','{"altro":"ST-I 19"}'),
('COP-KAL-452','Diametro 35 sp.19 L 2000','{"diametro":"35","spessore":"19","lunghezza":"2000"}'),
('COP-KAL-453','Diametro 76 sp.19 L 2000','{"diametro":"76","spessore":"19","lunghezza":"2000"}'),
('COP-KAL-454','Diametro 89 sp.19 L 2000','{"diametro":"89","spessore":"19","lunghezza":"2000"}'),
('COP-NUL-023','Diametro 80 densità 50','{"diametro":"80","densita":"50"}'),
('COP-NUL-271','Diametro 100 sp.30','{"diametro":"100","spessore":"30"}'),
('COP-SAC-024','MOD. ISOLcls 34/38 R120','{"altro":"MOD. ISOLcls 34/38 R120"}'),
('ART-00190','L 500 110/38','{"lunghezza":"500","altro":"110/38"}'),
('PAN-AMF-487','600x600','{"larghezza":"600","lunghezza":"600"}'),
('PAN-KNA-251','600x600 sp.15','{"larghezza":"600","lunghezza":"600","spessore":"15"}'),
('PAN-AMS-232','600x600 sp.14','{"larghezza":"600","lunghezza":"600","spessore":"14"}'),
('PAN-ROC-252','600x600 sp.12 bordi ribassati','{"larghezza":"600","lunghezza":"600","spessore":"12","bordi":"bordi ribassati"}'),
('PAN-KNA-466','600x600 sp.13 bordi dritti forellata','{"larghezza":"600","lunghezza":"600","spessore":"13","bordi":"bordi dritti","finitura":"forellata"}'),
('PAN-OWA-233','600x600 sp.14 bordi dritti','{"larghezza":"600","lunghezza":"600","spessore":"14","bordi":"bordi dritti"}'),
('PAN-OWA-234','600x600 sp.14 bordi ribassati','{"larghezza":"600","lunghezza":"600","spessore":"14","bordi":"bordi ribassati"}'),
('PAN-SUP-231','600x600 sp.6','{"larghezza":"600","lunghezza":"600","spessore":"6"}'),
('SIL-AFS-363','barattolo','{"formato":"barattolo"}'),
('SIL-AFS-95','tubetto','{"formato":"tubetto"}'),
('SIL-NUL-437','trasparente SP101','{"colore":"trasparente","altro":"SP101"}'),
('SIL-PRO-096','grigio','{"colore":"grigio"}'),
('SIL-PRO-097','bianco','{"colore":"bianco"}'),
('SIL-NUL-101','acetico','{"tipo":"acetico"}'),
('SIL-SOU-102','acrilico','{"tipo":"acrilico"}'),
('SIL-NUL-415','acrilico','{"tipo":"acrilico"}'),
('ART-00061','resistente','{"tipo":"resistente"}')
) AS v(code, new_model, attrs) ON i.code = v.code
WHERE i.deleted_at IS NULL AND i.category IN ('Collare', 'Coppella', 'Pannelli', 'Silicone');

UPDATE public.inventory i
SET model = p.new_model, variant_attributes = p.new_attributes
FROM public.variant_normalization_log_collare_coppella_pannelli_silicone_20261034 p
WHERE i.id = p.id AND i.model IS NOT DISTINCT FROM p.old_model;
