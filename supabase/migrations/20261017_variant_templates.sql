-- Schede personalizzate per la variante degli articoli.
--  * item_types.variant_template: scheda guidata della tipologia (campi + modello di composizione)
--  * inventory.variant_attributes: valori strutturati inseriti nella scheda (cercabili/filtrabili)
--  * gli admin possono modificare le tipologie (prima nessuna policy di UPDATE)
--  * prime schede: sotto-tipologie di Porte e Guide e Montanti

ALTER TABLE public.item_types ADD COLUMN IF NOT EXISTS variant_template jsonb;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS variant_attributes jsonb;

DROP POLICY IF EXISTS "Item types updatable by admin" ON public.item_types;
CREATE POLICY "Item types updatable by admin" ON public.item_types
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'));

INSERT INTO public.item_types (name, variant_template)
SELECT v.name, v.tpl::jsonb FROM (VALUES
('Porte tagliafuoco', '{"version":1,"pattern":"{resistenza} {misure} {ante} [FM {larghezza}x{altezza} mm] {apertura} [L1 {l1} mm] [L2 {l2} mm] {fissaggio} {altro}","fields":[
 {"key":"resistenza","label":"Resistenza al fuoco","kind":"choice","options":["REI 30","REI 60","REI 90","REI 120","EI 30","EI 60","EI 90","EI 120"],"required":true},
 {"key":"misure","label":"Misure","kind":"choice","options":["STD","MIS"],"required":true,"hint":"STD = standard, MIS = su misura"},
 {"key":"ante","label":"Ante","kind":"choice","options":["1A","2A"],"required":true},
 {"key":"larghezza","label":"Foro muro: larghezza","kind":"number","unit":"mm","required":true},
 {"key":"altezza","label":"Foro muro: altezza","kind":"number","unit":"mm","required":true},
 {"key":"apertura","label":"Apertura","kind":"choice","options":["tirare DX","tirare SX","spingere DX","spingere SX"],"required":true,"showIf":{"key":"ante","equals":"1A"}},
 {"key":"l1","label":"Anta 1 (L1): larghezza","kind":"number","unit":"mm","showIf":{"key":"ante","equals":"2A"}},
 {"key":"l2","label":"Anta 2 (L2): larghezza","kind":"number","unit":"mm","showIf":{"key":"ante","equals":"2A"}},
 {"key":"fissaggio","label":"Fissaggio telaio","kind":"choice","options":["da tassellare","da cartongesso"]},
 {"key":"altro","label":"Altro","kind":"text"}]}'),
('Telai porta', '{"version":1,"pattern":"{tipo} {fissaggio} [sp. muro {spessore_muro} mm] [per porta {larghezza}x{altezza} mm] {resistenza} {altro}","fields":[
 {"key":"tipo","label":"Tipo di telaio","kind":"choice","options":["abbracciante","isolato per tasselli","a Z"],"open":true,"required":true},
 {"key":"fissaggio","label":"Fissaggio","kind":"choice","options":["da tassellare","da cartongesso"]},
 {"key":"spessore_muro","label":"Spessore muro","kind":"number","unit":"mm"},
 {"key":"larghezza","label":"Per porta: larghezza","kind":"number","unit":"mm"},
 {"key":"altezza","label":"Per porta: altezza","kind":"number","unit":"mm"},
 {"key":"resistenza","label":"Resistenza al fuoco","kind":"choice","options":["REI 30","REI 60","REI 90","REI 120","EI 30","EI 60","EI 90","EI 120"]},
 {"key":"altro","label":"Altro","kind":"text"}]}'),
('Maniglioni antipanico', '{"version":1,"pattern":"{modello} [per porta {larghezza_porta} mm] {altro}","fields":[
 {"key":"modello","label":"Modello","kind":"choice","options":["SLASH SL BM","SLASH BM"],"open":true,"required":true},
 {"key":"larghezza_porta","label":"Per porta da (larghezza)","kind":"number","unit":"mm"},
 {"key":"altro","label":"Altro","kind":"text"}]}'),
('Chiudiporta', '{"version":1,"pattern":"{modello} {finitura} {altro}","fields":[
 {"key":"modello","label":"Modello","kind":"choice","options":["CP1"],"open":true,"required":true},
 {"key":"finitura","label":"Finitura","kind":"choice","options":["argento"],"open":true},
 {"key":"altro","label":"Altro","kind":"text"}]}'),
('Serrature', '{"version":1,"pattern":"{tipo} {azionamento} {altro}","fields":[
 {"key":"tipo","label":"Tipo","kind":"choice","options":["antipanico"],"open":true,"required":true},
 {"key":"azionamento","label":"Azionamento","kind":"choice","options":["a spingere","a tirare"],"open":true},
 {"key":"altro","label":"Altro","kind":"text"}]}'),
('Accessori porte', '{"version":1,"pattern":"{descrizione}","fields":[
 {"key":"descrizione","label":"Descrizione","kind":"text","required":true}]}'),
('Altro porte', '{"version":1,"pattern":"{descrizione}","fields":[
 {"key":"descrizione","label":"Descrizione","kind":"text","required":true}]}')
) AS v(name, tpl)
WHERE NOT EXISTS (SELECT 1 FROM public.item_types t WHERE t.name = v.name);

UPDATE public.item_types SET variant_template = '{"version":1,"pattern":"{larghezza}x{ala}x{lunghezza} [sp. {spessore}]","fields":[
 {"key":"larghezza","label":"Larghezza","kind":"number","unit":"mm","required":true},
 {"key":"ala","label":"Ala","kind":"number","unit":"mm","required":true},
 {"key":"lunghezza","label":"Lunghezza","kind":"number","unit":"mm","required":true},
 {"key":"spessore","label":"Spessore","kind":"choice","options":["6/10","8/10","10/10","12/10"],"open":true,"default":"6/10","hideWhenDefault":true,"hint":"6/10 è lo standard: se non diverso non compare nella variante"}]}'::jsonb
WHERE name = 'Guide e Montanti';
