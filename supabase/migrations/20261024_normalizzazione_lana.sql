-- Normalizzazione della Lana esistente secondo la scheda varianti (eseguita in produzione, approvata riga per riga).
--  * 25 articoli nel formato "Pannello o rotolo" (spessore x larghezza lato corto x lunghezza); 10 testi cambiano
--  * 2 articoli nel formato "Altro" (AF Seismic Joint, Lana con rete metallica): testo invariato
--  * restano senza variante AF Fireguard3 e AF Safeguard; i coefficienti non vengono toccati
--  * ripristino:
--      UPDATE public.inventory i SET model = l.old_model, variant_attributes = l.old_attributes
--      FROM public.variant_normalization_log_lana_20261024 l WHERE i.id = l.id;
CREATE TABLE IF NOT EXISTS public.variant_normalization_log_lana_20261024 AS
WITH p(code, sp, la, lu, dens, riv) AS (VALUES
('LAN-ROO-060','50','600','1200',NULL,NULL),
('LAN-ROO-464','40','600','1200',NULL,NULL),
('LAN-ROC-470','50','600','1200',NULL,NULL),
('LAN-AFS-458','100','55','1000',NULL,NULL),
('LAN-AFS-362','100','600','1000',NULL,NULL),
('LAN-AFS-471','100','88','1000',NULL,NULL),
('LAN-AFS-058','52','500','1000',NULL,NULL),
('LAN-AFS-275','52','600','1200',NULL,NULL),
('LAN-ROC-253','60','600','1200',NULL,NULL),
('LAN-ISO-314','100','600','1450',NULL,NULL),
('LAN-ISO-245','70','600','1450',NULL,NULL),
('LAN-ISO-244','95','600','1450',NULL,NULL),
('LAN-HIL-061','50','600','1000',NULL,NULL),
('LAN-KNA-063','50','600','1000',NULL,NULL),
('LAN-ISO-426','50','1200','13000',NULL,NULL),
('LAN-FIR-304','30','600','1000','80','alluminio'),
('LAN-MUL-305','50','600','1200',NULL,NULL),
('LAN-KNA-062','80','600','1000',NULL,NULL),
('LAN-TER-319','50','1200','12600',NULL,NULL),
('LAN-KNA-064','50','600','1200',NULL,NULL),
('LAN-KNA-065','60','600','1000',NULL,NULL),
('LAN-PRO-059','50','600','1000',NULL,NULL),
('LAN-PAR-069','50','600','1000',NULL,NULL),
('LAN-TEC-067','60','600','1200',NULL,NULL),
('LAN-KNA-066','60','600','1000',NULL,NULL)
), nuovi AS (
  SELECT code,
    sp || 'x' || la || 'x' || lu || coalesce(' ' || dens || ' kg/m³', '') || coalesce(' ' || riv, '') AS new_model,
    jsonb_strip_nulls(jsonb_build_object('_sottotipo','pannello','spessore',sp,'larghezza',la,'lunghezza',lu,'densita',dens,'rivestimento',riv)) AS new_attributes
  FROM p
  UNION ALL SELECT 'LAN-AFS-457', 'Ampiezza nominale giunto 600mm', '{"_sottotipo":"altro","descrizione":"Ampiezza nominale giunto 600mm"}'::jsonb
  UNION ALL SELECT 'LAN-PAR-068', 'Sp.10', '{"_sottotipo":"altro","descrizione":"Sp.10"}'::jsonb
)
SELECT i.id, i.code, i.name, i.model AS old_model, i.variant_attributes AS old_attributes,
       n.new_model, n.new_attributes, now() AS prepared_at
FROM public.inventory i
JOIN nuovi n ON n.code = i.code
WHERE i.deleted_at IS NULL AND i.category = 'Lana';

UPDATE public.inventory i
SET model = p.new_model, variant_attributes = p.new_attributes
FROM public.variant_normalization_log_lana_20261024 p
WHERE i.id = p.id AND i.model IS NOT DISTINCT FROM p.old_model;
