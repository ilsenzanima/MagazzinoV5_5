-- Porte, secondo passaggio (eseguito in produzione, approvato riga per riga).
--  * 6 articoli con i dati scritti nel nome: nome accorciato + variante nel formato della scheda
--  * rimandati: ART-00227 e ART-00216 (doppioni senza alcun riferimento, da decidere) -- nomi e varianti invariati
--  * ripristino:
--      UPDATE public.inventory i SET name = l.old_name, model = l.old_model, variant_attributes = l.old_attributes
--      FROM public.variant_normalization_log_porte2_20261029 l WHERE i.id = l.id;
CREATE TABLE IF NOT EXISTS public.variant_normalization_log_porte2_20261029 AS
SELECT i.id, i.code, i.name AS old_name, i.model AS old_model, i.variant_attributes AS old_attributes,
       v.new_name, v.new_model, v.attrs::jsonb AS new_attributes, now() AS prepared_at
FROM public.inventory i
JOIN (VALUES
('ART-00215','Porta tagliafuoco PROGET','REI 120 STD 1A FM 1000x2150 mm tirare SX abbracciante sp. muro 125 mm','{"_sottotipo":"porta","resistenza":"REI 120","misure":"STD","ante":"1A","larghezza":"1000","altezza":"2150","apertura":"tirare SX","tipo_telaio":"abbracciante","altro":"sp. muro 125 mm"}'),
('ART-00214','Porta tagliafuoco PROGET','REI 120 STD 1A FM 900x2150 mm tirare DX isolato per tasselli','{"_sottotipo":"porta","resistenza":"REI 120","misure":"STD","ante":"1A","larghezza":"900","altezza":"2150","apertura":"tirare DX","tipo_telaio":"isolato per tasselli"}'),
('ART-00230','Maniglione antipanico','SLASH BM per porta 1340 mm','{"_sottotipo":"maniglione","modello":"SLASH BM","larghezza_porta":"1340"}'),
('ART-00231','Telaio per porta','abbracciante sp. muro 160 mm per porta 1340x2500 mm','{"_sottotipo":"telaio","tipo":"abbracciante","spessore_muro":"160","larghezza":"1340","altezza":"2500"}'),
('ART-00217','Telaio per porta','abbracciante sp. muro 125 mm','{"_sottotipo":"telaio","tipo":"abbracciante","spessore_muro":"125"}'),
('ART-00219','Telaio per porta','isolato per tasselli per porta 900x2150 mm','{"_sottotipo":"telaio","tipo":"isolato per tasselli","larghezza":"900","altezza":"2150"}')
) AS v(code, new_name, new_model, attrs) ON i.code = v.code
WHERE i.deleted_at IS NULL AND i.category = 'Porte';

UPDATE public.inventory i
SET name = p.new_name, model = p.new_model, variant_attributes = p.new_attributes
FROM public.variant_normalization_log_porte2_20261029 p
WHERE i.id = p.id AND i.model IS NOT DISTINCT FROM p.old_model AND i.name = p.old_name;
