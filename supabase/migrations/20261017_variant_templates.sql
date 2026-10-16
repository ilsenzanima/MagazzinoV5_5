-- Schede personalizzate per la variante degli articoli.
--  * item_types.variant_template: scheda guidata della tipologia (campi, sottotipi, modello di composizione)
--  * inventory.variant_attributes: valori strutturati inseriti nella scheda (cercabili/filtrabili)
--  * gli admin possono modificare le tipologie (prima nessuna policy di UPDATE)
--  * prime schede: Porte (con sottotipi: porta, telaio, maniglione...), Lastre, Guide e Montanti, Profilati
--    I sottotipi NON sono nuove tipologie: servono solo a scegliere quali campi chiedere.

ALTER TABLE public.item_types ADD COLUMN IF NOT EXISTS variant_template jsonb;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS variant_attributes jsonb;

DROP POLICY IF EXISTS "Item types updatable by admin" ON public.item_types;
CREATE POLICY "Item types updatable by admin" ON public.item_types
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'));

UPDATE public.item_types SET variant_template = '{"version":2,"pattern":"","fields":[],"subtypeLabel":"Componente","subtypes":[
 {"key":"porta","label":"Porta tagliafuoco","suggestedName":"Porta tagliafuoco","pattern":"{resistenza} {misure} {ante} [FM {larghezza}x{altezza} mm] {apertura} [L1 {l1} mm] [L2 {l2} mm] {fissaggio} {altro}","fields":[
  {"key":"resistenza","label":"Resistenza al fuoco","kind":"choice","options":["REI 30","REI 60","REI 90","REI 120","EI 30","EI 60","EI 90","EI 120"],"required":true},
  {"key":"misure","label":"Misure","kind":"choice","options":["STD","MIS"],"required":true,"hint":"STD = standard, MIS = su misura"},
  {"key":"ante","label":"Ante","kind":"choice","options":["1A","2A"],"required":true},
  {"key":"larghezza","label":"Foro muro: larghezza","kind":"number","unit":"mm","required":true},
  {"key":"altezza","label":"Foro muro: altezza","kind":"number","unit":"mm","required":true},
  {"key":"apertura","label":"Apertura","kind":"choice","options":["tirare DX","tirare SX","spingere DX","spingere SX"],"required":true,"showIf":{"key":"ante","equals":"1A"}},
  {"key":"l1","label":"Anta 1 (L1): larghezza","kind":"number","unit":"mm","showIf":{"key":"ante","equals":"2A"}},
  {"key":"l2","label":"Anta 2 (L2): larghezza","kind":"number","unit":"mm","showIf":{"key":"ante","equals":"2A"}},
  {"key":"fissaggio","label":"Fissaggio telaio","kind":"choice","options":["da tassellare","da cartongesso"]},
  {"key":"altro","label":"Altro","kind":"text"}]},
 {"key":"telaio","label":"Telaio","suggestedName":"Telaio per porta","pattern":"{tipo} {fissaggio} [sp. muro {spessore_muro} mm] [per porta {larghezza}x{altezza} mm] {resistenza} {altro}","fields":[
  {"key":"tipo","label":"Tipo di telaio","kind":"choice","options":["abbracciante","isolato per tasselli","a Z"],"open":true,"required":true},
  {"key":"fissaggio","label":"Fissaggio","kind":"choice","options":["da tassellare","da cartongesso"]},
  {"key":"spessore_muro","label":"Spessore muro","kind":"number","unit":"mm"},
  {"key":"larghezza","label":"Per porta: larghezza","kind":"number","unit":"mm"},
  {"key":"altezza","label":"Per porta: altezza","kind":"number","unit":"mm"},
  {"key":"resistenza","label":"Resistenza al fuoco","kind":"choice","options":["REI 30","REI 60","REI 90","REI 120","EI 30","EI 60","EI 90","EI 120"]},
  {"key":"altro","label":"Altro","kind":"text"}]},
 {"key":"maniglione","label":"Maniglione antipanico","suggestedName":"Maniglione antipanico","pattern":"{modello} [per porta {larghezza_porta} mm] {altro}","fields":[
  {"key":"modello","label":"Modello","kind":"choice","options":["SLASH SL BM","SLASH BM"],"open":true,"required":true},
  {"key":"larghezza_porta","label":"Per porta da (larghezza)","kind":"number","unit":"mm"},
  {"key":"altro","label":"Altro","kind":"text"}]},
 {"key":"chiudiporta","label":"Chiudiporta","suggestedName":"Chiudiporta","pattern":"{modello} {finitura} {altro}","fields":[
  {"key":"modello","label":"Modello","kind":"choice","options":["CP1"],"open":true,"required":true},
  {"key":"finitura","label":"Finitura","kind":"choice","options":["argento"],"open":true},
  {"key":"altro","label":"Altro","kind":"text"}]},
 {"key":"serratura","label":"Serratura","suggestedName":"Serratura","pattern":"{tipo} {azionamento} {altro}","fields":[
  {"key":"tipo","label":"Tipo","kind":"choice","options":["antipanico"],"open":true,"required":true},
  {"key":"azionamento","label":"Azionamento","kind":"choice","options":["a spingere","a tirare"],"open":true},
  {"key":"altro","label":"Altro","kind":"text"}]},
 {"key":"accessori","label":"Accessori","suggestedName":"Accessori porte","pattern":"{descrizione}","fields":[
  {"key":"descrizione","label":"Descrizione","kind":"text","required":true}]},
 {"key":"altro","label":"Altro","pattern":"{descrizione}","fields":[
  {"key":"descrizione","label":"Descrizione","kind":"text","required":true}]}]}'::jsonb
WHERE name = 'Porte';

UPDATE public.item_types SET variant_template = '{"version":2,"pattern":"{larghezza}x{lunghezza} sp.{spessore} {altro}","coefficient":{"kind":"area","widthKey":"larghezza","lengthKey":"lunghezza","whenUnit":"MQ"},"fields":[
 {"key":"larghezza","label":"Larghezza","kind":"number","unit":"mm","required":true},
 {"key":"lunghezza","label":"Lunghezza","kind":"number","unit":"mm","required":true},
 {"key":"spessore","label":"Spessore","kind":"number","unit":"mm","required":true},
 {"key":"altro","label":"Altro (es. codici, classe)","kind":"text"}]}'::jsonb
WHERE name = 'Lastre';

UPDATE public.item_types SET variant_template = '{"version":2,"pattern":"{larghezza}x{ala}x{lunghezza} [sp.{spessore}]","coefficient":{"kind":"length","lengthKey":"lunghezza","whenUnit":"ML"},"fields":[
 {"key":"larghezza","label":"Larghezza","kind":"number","unit":"mm","required":true},
 {"key":"ala","label":"Ala","kind":"number","unit":"mm","required":true},
 {"key":"lunghezza","label":"Lunghezza","kind":"number","unit":"mm","required":true},
 {"key":"spessore","label":"Spessore","kind":"choice","options":["6/10","8/10","10/10","12/10"],"open":true,"default":"6/10","hideWhenDefault":true,"hint":"6/10 è lo standard: se non diverso non compare nella variante"}]}'::jsonb
WHERE name = 'Guide e Montanti';

UPDATE public.item_types SET variant_template = '{"version":2,"pattern":"","fields":[],"subtypeLabel":"Tipo di profilato","subtypes":[
 {"key":"paraspigoli","label":"Paraspigoli e angolari","pattern":"{materiale} {larghezza}x{ala}x{lunghezza} [sp.{spessore}]","coefficient":{"kind":"length","lengthKey":"lunghezza","whenUnit":"ML"},"fields":[
  {"key":"materiale","label":"Materiale","kind":"choice","options":["alluminio","inox","zincato"],"open":true},
  {"key":"larghezza","label":"Larghezza","kind":"number","unit":"mm","required":true},
  {"key":"ala","label":"Ala","kind":"number","unit":"mm","required":true},
  {"key":"lunghezza","label":"Lunghezza","kind":"number","unit":"mm","required":true},
  {"key":"spessore","label":"Spessore","kind":"choice","options":["6/10","8/10"],"open":true}]},
 {"key":"controsoffitto","label":"Profili controsoffitto","pattern":"{forma} {materiale} {colore} [base {base}] [lung. {lunghezza}]","coefficient":{"kind":"length","lengthKey":"lunghezza","whenUnit":"ML"},"fields":[
  {"key":"forma","label":"Forma / tipo","kind":"choice","options":["L","F","W","T"],"open":true,"required":true},
  {"key":"materiale","label":"Materiale","kind":"choice","options":["acciaio","lamiera zincata"],"open":true},
  {"key":"colore","label":"Colore","kind":"choice","options":["bianco","grigio"],"open":true},
  {"key":"base","label":"Base","kind":"number","unit":"mm"},
  {"key":"lunghezza","label":"Lunghezza","kind":"number","unit":"mm"}]},
 {"key":"lamiere","label":"Lamiere e profili in lamiera/inox","pattern":"{materiale} {spessore} {colore} {altro}","fields":[
  {"key":"materiale","label":"Materiale","kind":"choice","options":["lamiera zincata","inox A/304","preverniciata"],"open":true,"required":true},
  {"key":"spessore","label":"Spessore","kind":"choice","options":["6/10","8/10","10/10"],"open":true},
  {"key":"colore","label":"Colore","kind":"choice","options":["bianco puro"],"open":true},
  {"key":"altro","label":"Altro","kind":"text"}]}]}'::jsonb
WHERE name = 'Profilati';

-- Correzione dati: marca scritta come testo "NULL"
UPDATE public.inventory SET brand = 'MULTI' WHERE code = 'PRO-NUL-113' AND brand = 'NULL';
