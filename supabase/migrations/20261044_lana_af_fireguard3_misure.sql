-- Lana: AF Fireguard3 (LAN-AFS-057) riceve le misure indicate dall'utente: spessore 30, larghezza 1000, lunghezza 6000.
-- Il coefficiente resta 1 (si conta a metro lineare di rotolo largo 1000). Eseguita in produzione.
-- ripristino: UPDATE public.inventory i SET model = l.old_model, variant_attributes = l.old_attributes
--   FROM public.variant_normalization_log_lana2_20261044 l WHERE i.id = l.id;
CREATE TABLE IF NOT EXISTS public.variant_normalization_log_lana2_20261044 AS
SELECT id, code, name, model AS old_model, variant_attributes AS old_attributes,
       '30x1000x6000'::text AS new_model,
       '{"_sottotipo":"pannello","spessore":"30","larghezza":"1000","lunghezza":"6000"}'::jsonb AS new_attributes, now() AS prepared_at
FROM public.inventory WHERE code = 'LAN-AFS-057' AND deleted_at IS NULL;

UPDATE public.inventory i SET model = l.new_model, variant_attributes = l.new_attributes
FROM public.variant_normalization_log_lana2_20261044 l
WHERE i.id = l.id AND coalesce(i.model, '') = coalesce(l.old_model, '');
