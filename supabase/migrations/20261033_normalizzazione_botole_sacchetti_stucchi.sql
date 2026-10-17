-- Normalizzazione di Botole, Sacchetti e Stucco e Colle secondo le schede varianti (eseguita in produzione, approvata riga per riga).
--  * 19 articoli: testo nel formato della scheda + valori strutturati
--  * senza variante restano EBC 160, Promastop-S e 11 articoli di Stucco e Colle (nessun dato nel testo)
--  * ripristino:
--      UPDATE public.inventory i SET model = l.old_model, variant_attributes = l.old_attributes
--      FROM public.variant_normalization_log_botole_sacchetti_stucchi_20261033 l WHERE i.id = l.id;
CREATE TABLE IF NOT EXISTS public.variant_normalization_log_botole_sacchetti_stucchi_20261033 AS
SELECT i.id, i.code, i.name, i.category, i.model AS old_model, i.variant_attributes AS old_attributes,
       v.new_model, v.attrs::jsonb AS new_attributes, now() AS prepared_at
FROM public.inventory i
JOIN (VALUES
('ART-00116','300x300 2x20','{"larghezza":"300","altezza":"300","composizione":"2x20"}'),
('BOT-PRO-001','600x400 2x20','{"larghezza":"600","altezza":"400","composizione":"2x20"}'),
('ART-00018','500x500 setto 50 mm','{"larghezza":"500","altezza":"500","spessore_setto":"50"}'),
('ART-00017','600x600 setto 50 mm','{"larghezza":"600","altezza":"600","spessore_setto":"50"}'),
('BOT-KNA-303','400x400 a parete','{"larghezza":"400","altezza":"400","installazione":"a parete"}'),
('BOT-AKI-003','300x300','{"larghezza":"300","altezza":"300"}'),
('BOT-AKI-004','400x400','{"larghezza":"400","altezza":"400"}'),
('ART-00043','500x1000','{"larghezza":"500","altezza":"1000"}'),
('BOT-AKI-272','500x500','{"larghezza":"500","altezza":"500"}'),
('ART-00042','600x600','{"larghezza":"600","altezza":"600"}'),
('BOT-AKI-494','800x1000','{"larghezza":"800","altezza":"1000"}'),
('BOT-AKI-002','400x400','{"larghezza":"400","altezza":"400"}'),
('BOT-TOP-005','500x500','{"larghezza":"500","altezza":"500"}'),
('SAC-AFS-090','150x120','{"larghezza":"150","altezza":"120"}'),
('SAC-AFS-091','250x120','{"larghezza":"250","altezza":"120"}'),
('SAC-AFS-092','300x120','{"larghezza":"300","altezza":"120"}'),
('STU-KNA-352','secchio 20 KG','{"contenitore":"secchio","peso":"20"}'),
('COL-NUL-456','sacco 25 KG MM30','{"contenitore":"sacco","peso":"25","altro":"MM30"}'),
('ART-00114','Rasa&Ripara','{"altro":"Rasa&Ripara"}')
) AS v(code, new_model, attrs) ON i.code = v.code
WHERE i.deleted_at IS NULL AND i.category IN ('Botole', 'Sacchetti', 'Stucco e Colle');

UPDATE public.inventory i
SET model = p.new_model, variant_attributes = p.new_attributes
FROM public.variant_normalization_log_botole_sacchetti_stucchi_20261033 p
WHERE i.id = p.id AND i.model IS NOT DISTINCT FROM p.old_model;
