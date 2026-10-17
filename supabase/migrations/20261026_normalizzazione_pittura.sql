-- Normalizzazione della Pittura esistente secondo la scheda varianti (eseguita in produzione, approvata riga per riga).
--  * 28 articoli: testo nel formato della scheda (colore, RAL, uso, contenuto, altro) + valori strutturati; 24 testi cambiano
--  * senza variante restano Fungisol, Promapaint-SC3/SC4/W, Promaseal-A Spray, Promastop-CC liquid, Promastop-I, Sigmatex rapid
--  * ripristino:
--      UPDATE public.inventory i SET model = l.old_model, variant_attributes = l.old_attributes
--      FROM public.variant_normalization_log_pittura_20261026 l WHERE i.id = l.id;
CREATE TABLE IF NOT EXISTS public.variant_normalization_log_pittura_20261026 AS
SELECT i.id, i.code, i.name, i.model AS old_model, i.variant_attributes AS old_attributes,
       v.new_model, v.attrs::jsonb AS new_attributes, now() AS prepared_at
FROM public.inventory i
JOIN (VALUES
('PIT-NUL-326','per gesso','{"altro":"per gesso"}'),
('ART-00185','20 KG','{"contenuto":"20","um":"KG"}'),
('ART-00186','20 KG','{"contenuto":"20","um":"KG"}'),
('ART-00155','20 KG','{"contenuto":"20","um":"KG"}'),
('ART-00156','20 KG','{"contenuto":"20","um":"KG"}'),
('PIT-ARD-446','bianco fissativo','{"colore":"bianco","altro":"fissativo"}'),
('PIT-SIG-123','bianco','{"colore":"bianco"}'),
('PIT-SIG-321','colorato F0,33,66','{"colore":"colorato","altro":"F0,33,66"}'),
('ART-00019','colorato RAL 3016','{"colore":"colorato","ral":"3016"}'),
('PIT-SIG-373','lavabile','{"uso":"lavabile"}'),
('PIT-MAS-297','spray 400 ml','{"altro":"spray 400 ml"}'),
('PIT-COL-472','esterno 61200061K00F1 primer grigio','{"uso":"esterno","altro":"61200061K00F1 primer grigio"}'),
('PIT-COL-122','interno 61300435K00F1 primer grigio chiaro','{"uso":"interno","altro":"61300435K00F1 primer grigio chiaro"}'),
('PIT-COL-121','esterno 94100209L0027','{"uso":"esterno","altro":"94100209L0027"}'),
('ART-00082','interno 94110230L0016','{"uso":"interno","altro":"94110230L0016"}'),
('ART-00081','interno 94110233L0018','{"uso":"interno","altro":"94110233L0018"}'),
('PIT-COL-120','bianco 5L42','{"colore":"bianco","altro":"5L42"}'),
('PIT-IVA-350','acrilico','{"altro":"acrilico"}'),
('PIT-IVA-349','bianco lavabile idrosmalto opaco','{"colore":"bianco","uso":"lavabile","altro":"idrosmalto opaco"}'),
('PIT-IVA-348','bianco traspirante','{"colore":"bianco","uso":"traspirante"}'),
('PIT-COL-126','bianco','{"colore":"bianco"}'),
('PIT-SIG-124','bianco','{"colore":"bianco"}'),
('PIT-SIG-125','bianco','{"colore":"bianco"}'),
('ART-00021','colorato RAL 7037 opaco','{"colore":"colorato","ral":"7037","uso":"opaco"}'),
('ART-00020','colorato RAL 5018','{"colore":"colorato","ral":"5018"}'),
('PIT-ARD-447','bianco lavabile','{"colore":"bianco","uso":"lavabile"}'),
('VAR-NUL-441','bomboletta','{"altro":"bomboletta"}'),
('PIT-SIG-286','colorato RAL 3000 2,5 L base Z','{"colore":"colorato","ral":"3000","contenuto":"2,5","um":"L","altro":"base Z"}')
) AS v(code, new_model, attrs) ON i.code = v.code
WHERE i.deleted_at IS NULL AND i.category = 'Pittura';

UPDATE public.inventory i
SET model = p.new_model, variant_attributes = p.new_attributes
FROM public.variant_normalization_log_pittura_20261026 p
WHERE i.id = p.id AND i.model IS NOT DISTINCT FROM p.old_model;
