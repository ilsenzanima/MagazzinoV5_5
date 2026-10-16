-- Porte: eliminazione di due doppioni senza alcun riferimento (acquisti, movimenti, bolle, commesse, SAL, analisi costi, proposte)
-- e nome coerente per i due articoli che restano (eseguito in produzione, approvato).
--  * ART-00227 = ART-00229 (stessa porta REI 60 MIS 1A FM 1340x2500 tirare SX) -> eliminato ART-00227
--  * ART-00216 = ART-00206 (stesso maniglione SLASH SL BM) -> eliminato ART-00216
--  * ripristino (articoli eliminati e nomi precedenti):
--      UPDATE public.inventory i SET name = l.old_name, variant_attributes = l.old_attributes,
--        deleted_at = l.old_deleted_at, deleted_by_name = l.old_deleted_by_name
--      FROM public.variant_normalization_log_porte3_20261029 l WHERE i.id = l.id;
CREATE TABLE IF NOT EXISTS public.variant_normalization_log_porte3_20261029 AS
SELECT id, code, name AS old_name, model AS old_model, variant_attributes AS old_attributes, deleted_at AS old_deleted_at, deleted_by_name AS old_deleted_by_name, now() AS prepared_at
FROM public.inventory WHERE code IN ('ART-00227','ART-00216','ART-00229','ART-00206');

UPDATE public.inventory SET deleted_at = now(), deleted_by_name = 'Pulizia doppioni (Claude)'
WHERE code IN ('ART-00227','ART-00216') AND deleted_at IS NULL;

UPDATE public.inventory SET name = 'Porta tagliafuoco PROGET',
  variant_attributes = '{"_sottotipo":"porta","resistenza":"REI 60","misure":"MIS","ante":"1A","larghezza":"1340","altezza":"2500","apertura":"tirare SX"}'::jsonb
WHERE code = 'ART-00229';

UPDATE public.inventory SET name = 'Maniglione antipanico',
  variant_attributes = '{"_sottotipo":"maniglione","modello":"SLASH SL BM"}'::jsonb
WHERE code = 'ART-00206';
