-- Varie (e spazi finali dei nomi anche in Attrezzatura): pulizia del testo (eseguita in produzione, approvata riga per riga).
--  * 31 varianti di Varie uniformate (minuscole, decimali con la virgola, misure in mm, diametri come "ø 80")
--  * tolti gli spazi finali dai nomi di Varie e Attrezzatura
--  * ripristino:
--      UPDATE public.inventory i SET name = l.old_name, model = l.old_model
--      FROM public.variant_cleanup_log_varie_20261037 l WHERE i.id = l.id;
CREATE TABLE IF NOT EXISTS public.variant_cleanup_log_varie_20261037 AS
SELECT i.id, i.code, i.category, i.name AS old_name, i.model AS old_model,
       btrim(i.name) AS new_name, coalesce(m.new_model, i.model) AS new_model, now() AS prepared_at
FROM public.inventory i
LEFT JOIN (VALUES
('ART-00130','calcio silicato'),
('ART-00077','cartongesso'),
('ART-00195','coppella gesso e cartone'),
('ART-00076','ferro'),
('ART-00226','inerti'),
('ART-00194','lana minerale'),
('ART-00212','secchi vuoti'),
('ART-00120','tubetti silicone'),
('ART-00225','120x1500'),
('VAR-WUR-486','13 mm lunga'),
('VAR-NUL-315','ø 80'),
('ART-00088','liquido'),
('ART-00089','pasta'),
('ART-00164','nitro 5 L'),
('ART-00060','7,8x540'),
('ART-00069','7,8x750'),
('VAR-WUR-462','ø 13/21'),
('VAR-WUR-461','ø 38/50'),
('VAR-WUR-463','ø 50'),
('VAR-KLO-246','1500x50000'),
('ART-00159','foro rombo 43x13 mm'),
('VAR-WUR-139','standard'),
('VAR-BEG-361','18 W autonomia 1 ora'),
('VAR-BEG-360','24 W autonomia 1 ora'),
('VAR-POL-142','595x1195 sp.40 baffles'),
('VAR-POL-143','595x1195 sp.40 magnetico'),
('ART-00131','rettangolare 800x250 manuale'),
('ART-00152','AzzurraBluSky sp.0,12'),
('ART-00196','fogli nero 0,20 ml 4 rigenerato 50 kg 260 mq'),
('ART-00072','diametro interno 127 mm'),
('VAR-ROC-141','bianco 4FR')
) AS m(code, new_model) ON i.code = m.code
WHERE i.deleted_at IS NULL AND i.category IN ('Varie', 'Attrezzatura')
  AND (m.code IS NOT NULL OR i.name <> btrim(i.name));

UPDATE public.inventory i
SET name = p.new_name, model = p.new_model
FROM public.variant_cleanup_log_varie_20261037 p
WHERE i.id = p.id AND i.name = p.old_name AND i.model IS NOT DISTINCT FROM p.old_model;
