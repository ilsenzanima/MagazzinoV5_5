-- Normalizzazione delle Porte esistenti secondo la scheda varianti (eseguita in produzione, approvata riga per riga).
--  * 26 articoli: testo nel formato della scheda + valori strutturati (con _sottotipo)
--  * rimandati a un secondo passaggio (dati nel nome, variante vuota): ART-00215, 00214, 00227, 00230, 00216, 00231, 00217, 00219
--  * senza variante restano POR-NEW-279, POR-NEW-278, POR-NIN-397
--  * ripristino:
--      UPDATE public.inventory i SET model = l.old_model, variant_attributes = l.old_attributes
--      FROM public.variant_normalization_log_porte_20261028 l WHERE i.id = l.id;
CREATE TABLE IF NOT EXISTS public.variant_normalization_log_porte_20261028 AS
SELECT i.id, i.code, i.name, i.model AS old_model, i.variant_attributes AS old_attributes,
       v.new_model, v.attrs::jsonb AS new_attributes, now() AS prepared_at
FROM public.inventory i
JOIN (VALUES
('ART-00229','REI 60 MIS 1A FM 1340x2500 mm tirare SX','{"_sottotipo":"porta","resistenza":"REI 60","misure":"MIS","ante":"1A","larghezza":"1340","altezza":"2500","apertura":"tirare SX"}'),
('POR-NEW-276','EI 120 MIS 1A FM 880x2150 mm da tassellare','{"_sottotipo":"porta","resistenza":"EI 120","misure":"MIS","ante":"1A","larghezza":"880","altezza":"2150","fissaggio":"da tassellare"}'),
('ART-00205','REI 60 MIS 1A FM 1270x1990 mm tirare SX','{"_sottotipo":"porta","resistenza":"REI 60","misure":"MIS","ante":"1A","larghezza":"1270","altezza":"1990","apertura":"tirare SX"}'),
('ART-00201','REI 60 MIS 1A FM 1270x2000 mm tirare DX','{"_sottotipo":"porta","resistenza":"REI 60","misure":"MIS","ante":"1A","larghezza":"1270","altezza":"2000","apertura":"tirare DX"}'),
('ART-00203','REI 60 MIS 1A FM 1270x2000 mm tirare SX','{"_sottotipo":"porta","resistenza":"REI 60","misure":"MIS","ante":"1A","larghezza":"1270","altezza":"2000","apertura":"tirare SX"}'),
('ART-00202','REI 60 MIS 1A FM 1270x2010 mm tirare DX','{"_sottotipo":"porta","resistenza":"REI 60","misure":"MIS","ante":"1A","larghezza":"1270","altezza":"2010","apertura":"tirare DX"}'),
('ART-00211','REI 60 MIS 1A FM 1270x2010 mm tirare SX','{"_sottotipo":"porta","resistenza":"REI 60","misure":"MIS","ante":"1A","larghezza":"1270","altezza":"2010","apertura":"tirare SX"}'),
('ART-00200','REI 60 MIS 1A FM 1280x1990 mm tirare SX','{"_sottotipo":"porta","resistenza":"REI 60","misure":"MIS","ante":"1A","larghezza":"1280","altezza":"1990","apertura":"tirare SX"}'),
('ART-00204','REI 60 MIS 1A FM 1280x2010 mm tirare DX','{"_sottotipo":"porta","resistenza":"REI 60","misure":"MIS","ante":"1A","larghezza":"1280","altezza":"2010","apertura":"tirare DX"}'),
('ART-00168','REI 120 MIS 1A FM 830x2150 mm tirare DX','{"_sottotipo":"porta","resistenza":"REI 120","misure":"MIS","ante":"1A","larghezza":"830","altezza":"2150","apertura":"tirare DX"}'),
('ART-00111','REI 120 MIS 1A FM 930x2100 mm + accessori','{"_sottotipo":"porta","resistenza":"REI 120","misure":"MIS","ante":"1A","larghezza":"930","altezza":"2100","altro":"+ accessori"}'),
('ART-00110','REI 120 MIS 2A FM 1120x2150 mm L1 560 mm L2 560 mm + accessori','{"_sottotipo":"porta","resistenza":"REI 120","misure":"MIS","ante":"2A","larghezza":"1120","altezza":"2150","l1":"560","l2":"560","altro":"+ accessori"}'),
('ART-00109','REI 120 MIS 2A FM 2052x2460 mm L1 1025 mm L2 1025 mm + accessori','{"_sottotipo":"porta","resistenza":"REI 120","misure":"MIS","ante":"2A","larghezza":"2052","altezza":"2460","l1":"1025","l2":"1025","altro":"+ accessori"}'),
('ART-00108','REI 60 MIS 1A FM 1120x2360 mm','{"_sottotipo":"porta","resistenza":"REI 60","misure":"MIS","ante":"1A","larghezza":"1120","altezza":"2360"}'),
('ART-00167','REI 60 MIS 1A FM 850x2010 mm tirare SX','{"_sottotipo":"porta","resistenza":"REI 60","misure":"MIS","ante":"1A","larghezza":"850","altezza":"2010","apertura":"tirare SX"}'),
('ART-00107','REI 60 MIS 2A FM 1260x2150 mm L1 630 mm L2 630 mm','{"_sottotipo":"porta","resistenza":"REI 60","misure":"MIS","ante":"2A","larghezza":"1260","altezza":"2150","l1":"630","l2":"630"}'),
('POR-NIN-440','REI 120 STD 2A FM 1600x2150 mm','{"_sottotipo":"porta","resistenza":"REI 120","misure":"STD","ante":"2A","larghezza":"1600","altezza":"2150"}'),
('ART-00165','REI 120 STD 1A FM 900x2150 mm tirare DX','{"_sottotipo":"porta","resistenza":"REI 120","misure":"STD","ante":"1A","larghezza":"900","altezza":"2150","apertura":"tirare DX"}'),
('ART-00184','REI 120 STD 1A FM 900x2150 mm tirare SX','{"_sottotipo":"porta","resistenza":"REI 120","misure":"STD","ante":"1A","larghezza":"900","altezza":"2150","apertura":"tirare SX"}'),
('POR-NIN-376','REI 60 MIS 1A FM 800x1990 mm','{"_sottotipo":"porta","resistenza":"REI 60","misure":"MIS","ante":"1A","larghezza":"800","altezza":"1990"}'),
('POR-NIN-493','REI 60 STD 1A FM 1000x2050 mm tirare SX','{"_sottotipo":"porta","resistenza":"REI 60","misure":"STD","ante":"1A","larghezza":"1000","altezza":"2050","apertura":"tirare SX"}'),
('POR-NIN-492','REI 60 STD 1A FM 1300x2150 mm tirare SX','{"_sottotipo":"porta","resistenza":"REI 60","misure":"STD","ante":"1A","larghezza":"1300","altezza":"2150","apertura":"tirare SX"}'),
('POR-NEW-277','EI 120 2180x980+980','{"_sottotipo":"telaio","resistenza":"EI 120","altro":"2180x980+980"}'),
('ART-00206','SLASH SL BM','{"_sottotipo":"maniglione","modello":"SLASH SL BM"}'),
('ART-00207','CP1 argento','{"_sottotipo":"chiudiporta","modello":"CP1","finitura":"argento"}'),
('ART-00112','antipanico a spingere','{"_sottotipo":"serratura","tipo":"antipanico","azionamento":"a spingere"}')
) AS v(code, new_model, attrs) ON i.code = v.code
WHERE i.deleted_at IS NULL AND i.category = 'Porte';

UPDATE public.inventory i
SET model = p.new_model, variant_attributes = p.new_attributes
FROM public.variant_normalization_log_porte_20261028 p
WHERE i.id = p.id AND i.model IS NOT DISTINCT FROM p.old_model;
