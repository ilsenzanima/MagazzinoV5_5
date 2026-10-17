-- Correzioni dati richieste dopo l'analisi delle schede varianti.
--  * la marca "NULL" era una voce generica del vecchio sistema: diventa MULTI (82 articoli attivi)
--  * montante MON-----202 (149x50x2800): coefficiente 2,8 invece di 3; si conta in pezzi fisici (5 barre = 14 ML).
--    Il coefficiente del lotto si cambia per primo: il trigger ricalcola la quantita' del lotto e del magazzino.
UPDATE public.inventory SET brand = 'MULTI' WHERE brand = 'NULL' AND deleted_at IS NULL;
UPDATE public.purchase_items SET coefficient = 2.8 WHERE id = 'c627e7cb-ab36-4fdf-8151-fba170f3fe78' AND coefficient = 3;
UPDATE public.inventory SET coefficient = 2.8 WHERE code = 'MON-----202' AND coefficient = 3;
