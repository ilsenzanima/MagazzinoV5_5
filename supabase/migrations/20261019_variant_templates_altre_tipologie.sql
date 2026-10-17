-- Schede varianti per le altre tipologie. Le misure sono in mm (salvo pollici o filettature).
-- Nel modello, [A|B] usa la prima alternativa i cui campi sono tutti compilati.
-- Attrezzatura, Varie, Box, Brick, Pressurizzatori e Guaina restano a testo libero (con suggerimenti
-- dalle varianti già usate per lo stesso nome).
UPDATE public.item_types t SET variant_template = v.tpl::jsonb FROM (VALUES
('Viti', '{"version":2,"pattern":"[{diametro}x{lunghezza}|{lunghezza} mm] {punta} {testa} {finitura} {altro}","fields":[
 {"key":"diametro","label":"Diametro","kind":"text","hint":"In mm, oppure M8 per le filettature"},
 {"key":"lunghezza","label":"Lunghezza","kind":"number","unit":"mm","required":true},
 {"key":"punta","label":"Punta","kind":"choice","options":["punta trapano","punta chiodo"],"open":true},
 {"key":"testa","label":"Testa","kind":"choice","options":["testa esagonale","testa svasata piana","testa bombata","testa torx"],"open":true},
 {"key":"finitura","label":"Finitura","kind":"choice","options":["inox","zincata","fosfatata nera"],"open":true},
 {"key":"altro","label":"Altro","kind":"text"}]}'),
('Tasselli', '{"version":2,"pattern":"[{diametro}x{lunghezza}|{diametro}] {dotazione} {altro}","fields":[
 {"key":"diametro","label":"Diametro","kind":"text","required":true,"hint":"In mm, oppure M8 per le filettature"},
 {"key":"lunghezza","label":"Lunghezza","kind":"number","unit":"mm"},
 {"key":"dotazione","label":"Dotazione","kind":"choice","options":["con vite","senza vite","con occhiolo","con vite ad occhiolo"],"open":true},
 {"key":"altro","label":"Altro (codici)","kind":"text"}]}'),
('Pittura', '{"version":2,"pattern":"{colore} [RAL {ral}] {uso} [{contenuto} {um}] {altro}","fields":[
 {"key":"colore","label":"Colore","kind":"choice","options":["bianco","colorato"],"open":true},
 {"key":"ral","label":"Codice RAL","kind":"text"},
 {"key":"uso","label":"Uso / finitura","kind":"choice","options":["interno","esterno","lavabile","opaco","traspirante"],"open":true},
 {"key":"contenuto","label":"Contenuto","kind":"number","fillsPackQuantity":true,"hint":"Peso o volume della confezione: è anche la quantità per confezione"},
 {"key":"um","label":"Unità del contenuto","kind":"choice","options":["KG","L"]},
 {"key":"altro","label":"Altro","kind":"text"}]}'),
('Nastri', '{"version":2,"pattern":"[{larghezza}x{lunghezza}|{larghezza} mm] {tipo} {altro}","fields":[
 {"key":"larghezza","label":"Larghezza","kind":"number","unit":"mm","required":true},
 {"key":"lunghezza","label":"Lunghezza","kind":"number","unit":"mm"},
 {"key":"tipo","label":"Tipo","kind":"choice","options":["mascheratura","carta","gommato","imballo","alluminio","biadesivo","monoadesivo","protettivo"],"open":true},
 {"key":"altro","label":"Altro","kind":"text"}]}'),
('Botole', '{"version":2,"pattern":"{larghezza}x{altezza} [setto {spessore_setto} mm] {installazione} [{composizione}] {altro}","fields":[
 {"key":"larghezza","label":"Larghezza","kind":"number","unit":"mm","required":true},
 {"key":"altezza","label":"Altezza","kind":"number","unit":"mm","required":true},
 {"key":"spessore_setto","label":"Utilizzabile in setto da","kind":"number","unit":"mm"},
 {"key":"installazione","label":"Installazione","kind":"choice","options":["a parete","a soffitto"],"open":true},
 {"key":"composizione","label":"Composizione","kind":"text","hint":"Es. 2x20 = 2 lastre da 20 mm"},
 {"key":"altro","label":"Altro","kind":"text"}]}'),
('Pannelli', '{"version":2,"pattern":"{larghezza}x{lunghezza} sp.{spessore} {bordi} {finitura} {altro}","coefficient":{"kind":"area","widthKey":"larghezza","lengthKey":"lunghezza","whenUnit":"MQ"},"fields":[
 {"key":"larghezza","label":"Larghezza","kind":"number","unit":"mm","required":true},
 {"key":"lunghezza","label":"Lunghezza","kind":"number","unit":"mm","required":true},
 {"key":"spessore","label":"Spessore","kind":"number","unit":"mm","required":true},
 {"key":"bordi","label":"Bordi","kind":"choice","options":["bordi dritti","bordi ribassati"],"open":true},
 {"key":"finitura","label":"Finitura","kind":"choice","options":["forellata"],"open":true},
 {"key":"altro","label":"Altro","kind":"text"}]}'),
('Collare', '{"version":2,"pattern":"[Diametro {diametro}] {altro}","fields":[
 {"key":"diametro","label":"Diametro","kind":"number","unit":"mm"},
 {"key":"altro","label":"Altro (misure o modello)","kind":"text"}]}'),
('Sacchetti', '{"version":2,"pattern":"{larghezza}x{altezza}","fields":[
 {"key":"larghezza","label":"Larghezza","kind":"number","unit":"mm","required":true},
 {"key":"altezza","label":"Altezza","kind":"number","unit":"mm","required":true}]}'),
('Coppella', '{"version":2,"pattern":"[Diametro {diametro}] [sp.{spessore}] [L {lunghezza}] [densità {densita}] {altro}","fields":[
 {"key":"diametro","label":"Diametro","kind":"number","unit":"mm"},
 {"key":"spessore","label":"Spessore","kind":"number","unit":"mm"},
 {"key":"lunghezza","label":"Lunghezza","kind":"number","unit":"mm"},
 {"key":"densita","label":"Densità","kind":"number","unit":"kg/m³"},
 {"key":"altro","label":"Altro (modello)","kind":"text"}]}'),
('Ferramenta', '{"version":2,"pattern":"","fields":[],"subtypeLabel":"Tipo di articolo","subtypes":[
 {"key":"viteria","label":"Viteria (rondelle, dadi, barre)","pattern":"[{diametro}x{lunghezza}|{diametro}] [{dimensioni}] {finitura} {altro}","fields":[
  {"key":"diametro","label":"Diametro / filettatura","kind":"text","required":true,"hint":"M10, 10,5…"},
  {"key":"lunghezza","label":"Lunghezza","kind":"number","unit":"mm"},
  {"key":"dimensioni","label":"Altre misure","kind":"text","hint":"Es. 30x2,5 per le rondelle"},
  {"key":"finitura","label":"Finitura / classe","kind":"choice","options":["zincato","inox A2K","HDG","8.8"],"open":true},
  {"key":"altro","label":"Altro","kind":"text"}]},
 {"key":"pendini","label":"Pendini e ganci","pattern":"{lunghezza} {terminale} {altro}","fields":[
  {"key":"lunghezza","label":"Lunghezza","kind":"number","unit":"mm","required":true},
  {"key":"terminale","label":"Terminale","kind":"choice","options":["gancio","occhiolo","occhiolo a 90°","molla"],"open":true},
  {"key":"altro","label":"Altro","kind":"text"}]},
 {"key":"profili","label":"Profili e tubi","pattern":"{sezione}[x{lunghezza}] {altro}","fields":[
  {"key":"sezione","label":"Sezione","kind":"text","required":true,"hint":"Es. 100x100 oppure 150x50x3"},
  {"key":"lunghezza","label":"Lunghezza","kind":"number","unit":"mm"},
  {"key":"altro","label":"Altro","kind":"text"}]},
 {"key":"altro","label":"Altro","pattern":"{descrizione}","fields":[
  {"key":"descrizione","label":"Descrizione","kind":"text","required":true}]}]}')
) AS v(name, tpl) WHERE t.name = v.name;
