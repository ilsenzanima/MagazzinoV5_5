-- Scheda Porte, componente "Porta tagliafuoco":
--  * il numero di ante si chiede dopo le misure del foro muro
--  * nuova scelta "Tipo di telaio" (abbracciante, isolato per tasselli, a Z) prima del fissaggio
UPDATE public.item_types SET variant_template = jsonb_set(
    jsonb_set(
        variant_template,
        '{subtypes,0,fields}',
        '[
  {"key":"resistenza","label":"Resistenza al fuoco","kind":"choice","options":["REI 30","REI 60","REI 90","REI 120","EI 30","EI 60","EI 90","EI 120"],"required":true},
  {"key":"misure","label":"Misure","kind":"choice","options":["STD","MIS"],"required":true,"hint":"STD = standard, MIS = su misura"},
  {"key":"larghezza","label":"Foro muro: larghezza","kind":"number","unit":"mm","required":true},
  {"key":"altezza","label":"Foro muro: altezza","kind":"number","unit":"mm","required":true},
  {"key":"ante","label":"Ante","kind":"choice","options":["1A","2A"],"required":true},
  {"key":"apertura","label":"Apertura","kind":"choice","options":["tirare DX","tirare SX","spingere DX","spingere SX"],"required":true,"showIf":{"key":"ante","equals":"1A"}},
  {"key":"l1","label":"Anta 1 (L1): larghezza","kind":"number","unit":"mm","showIf":{"key":"ante","equals":"2A"}},
  {"key":"l2","label":"Anta 2 (L2): larghezza","kind":"number","unit":"mm","showIf":{"key":"ante","equals":"2A"}},
  {"key":"tipo_telaio","label":"Tipo di telaio","kind":"choice","options":["abbracciante","isolato per tasselli","a Z"],"open":true},
  {"key":"fissaggio","label":"Fissaggio telaio","kind":"choice","options":["da tassellare","da cartongesso"]},
  {"key":"altro","label":"Altro","kind":"text"}]'::jsonb
    ),
    '{subtypes,0,pattern}',
    '"{resistenza} {misure} {ante} [FM {larghezza}x{altezza} mm] {apertura} [L1 {l1} mm] [L2 {l2} mm] {tipo_telaio} {fissaggio} {altro}"'::jsonb
)
WHERE name = 'Porte' AND variant_template->'subtypes'->0->>'key' = 'porta';
