-- Attrezzatura: pulizia del testo delle varianti e correzione di tre refusi nei nomi (eseguita in produzione, approvata riga per riga).
--  * 38 varianti uniformate (minuscole, decimali con la virgola, misure in mm, diametri come "ø 10")
--  * nomi corretti: ATT-WUR-389, VAR-NUL-288, VAR-NUL-289
--  * nessuna scheda: l'Attrezzatura resta senza dati strutturati
--  * ripristino:
--      UPDATE public.inventory i SET name = l.old_name, model = l.old_model
--      FROM public.variant_cleanup_log_attrezzatura_20261036 l WHERE i.id = l.id;
CREATE TABLE IF NOT EXISTS public.variant_cleanup_log_attrezzatura_20261036 AS
SELECT i.id, i.code, i.name AS old_name, i.model AS old_model,
       coalesce(n.new_name, i.name) AS new_name, coalesce(m.new_model, i.model) AS new_model, now() AS prepared_at
FROM public.inventory i
LEFT JOIN (VALUES
('ART-00095','ø 10'),
('ART-00177','ø 3,5'),
('ART-00092','ø 15'),
('ATT-NUL-421','ø 8'),
('ART-00087','ø 20'),
('ATT-WUR-410','ø 6'),
('ART-00074','ø 121'),
('ART-00075','ø 152'),
('ATT-WUR-480','croce PZ'),
('ART-00106','croce PZ C 6,3 (PZ 3)'),
('ART-00222','torx RW 20'),
('ART-00121','torx RW C 6,3'),
('ATT-WUR-476','150 mm'),
('ATT-NUL-439','400 mm'),
('ATT-NUL-438','125 mm'),
('VAR-NUL-290','100 mm ricambio'),
('ART-00026','25 mm'),
('ART-00039','per diametro 16 mm'),
('ART-00067','per diametro 25-27 mm'),
('ART-00144','6 m'),
('ART-00023','n. 4'),
('ART-00192','n. 5'),
('ART-00022','n. 6'),
('ART-00145','da spina a presa CEE'),
('ART-00101','cercafase'),
('ART-00161','set 6 pz'),
('ART-00034','sottile'),
('ART-00033','nitrile'),
('ART-00100','FFP1 con valvola'),
('ART-00197','FFP3 carbon'),
('ATT-WUR-428','confezione da 6'),
('ART-00038','nero'),
('VAR-NUL-298','attacco per bastone'),
('ART-00160','manuale'),
('VAR-NUL-293','per lana di roccia'),
('ART-00158','a tazza'),
('ART-00157','circolare'),
('ART-00056','fili in ottone')
) AS m(code, new_model) ON i.code = m.code
LEFT JOIN (VALUES
('ATT-WUR-389','Kit chiavi a bussola per Avvitatore'),
('VAR-NUL-288','Pennellessa Storta'),
('VAR-NUL-289','Griglia per pittura a rullo')
) AS n(code, new_name) ON i.code = n.code
WHERE i.deleted_at IS NULL AND i.category = 'Attrezzatura' AND (m.code IS NOT NULL OR n.code IS NOT NULL);

UPDATE public.inventory i
SET name = p.new_name, model = p.new_model
FROM public.variant_cleanup_log_attrezzatura_20261036 p
WHERE i.id = p.id AND i.name = p.old_name AND i.model IS NOT DISTINCT FROM p.old_model;
