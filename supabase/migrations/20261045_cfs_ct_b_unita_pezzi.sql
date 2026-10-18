-- Lana: CFS-CT B (LAN-HIL-061) si conta a pezzi, quindi l'unità passa da MQ a PZ (coefficiente 1 invariato). Eseguita in produzione.
-- ripristino: UPDATE public.inventory i SET unit = l.old_unit FROM public.unit_change_log_20261045 l WHERE i.id = l.id;
CREATE TABLE IF NOT EXISTS public.unit_change_log_20261045 AS
SELECT id, code, name, unit AS old_unit, 'PZ'::text AS new_unit, coefficient, now() AS prepared_at
FROM public.inventory WHERE code = 'LAN-HIL-061' AND deleted_at IS NULL;

UPDATE public.inventory i SET unit = 'PZ'
FROM public.unit_change_log_20261045 l WHERE i.id = l.id AND i.unit = l.old_unit;
