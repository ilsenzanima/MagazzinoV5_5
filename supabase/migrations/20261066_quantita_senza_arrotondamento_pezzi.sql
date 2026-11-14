-- Quantità invariata quando i pezzi sono solo arrotondati a 2 decimali.
--
-- Problema: l'app invia sia la quantità (es. 16 ML) sia i pezzi (16 / 3 = 5,33,
-- arrotondati a 2 decimali). Il trigger riscriveva sempre
--   quantity := pieces * coefficient  ->  5,33 * 3 = 15,99
-- e quindi si perdevano centesimi su ogni quantità non multipla del coefficiente
-- (es. 28 ML -> 27,99, 54 ML -> 53,97).
--
-- Correzione: se quantità e pezzi sono coerenti entro l'arrotondamento dei pezzi
-- (mezzo centesimo di pezzo), la quantità inserita resta com'è. Se sono
-- incoerenti (es. cambiati i pezzi ma non la quantità) vale ancora la regola
-- precedente: i pezzi sono la fonte di verità.
--
-- Non modifica le righe già salvate: quelle vanno corrette a parte.

CREATE OR REPLACE FUNCTION public.calculate_quantity_from_pieces()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.pieces IS NOT NULL THEN
        IF NEW.quantity IS NOT NULL
           AND COALESCE(NEW.coefficient, 0) <> 0
           AND ABS(NEW.quantity - NEW.pieces * NEW.coefficient) <= 0.005 * ABS(NEW.coefficient) + 0.000001
        THEN
            -- quantità coerente con i pezzi arrotondati: non toccarla
            NULL;
        ELSE
            NEW.quantity := NEW.pieces * NEW.coefficient;
        END IF;
    ELSIF NEW.quantity IS NOT NULL AND NEW.pieces IS NULL THEN
        IF NEW.coefficient <> 0 THEN
            NEW.pieces := ROUND(NEW.quantity / NEW.coefficient, 2);
            -- la quantità inserita resta quella digitata
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;
