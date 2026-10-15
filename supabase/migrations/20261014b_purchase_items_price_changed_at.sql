-- Controllo acquisti: quando cambia il prezzo di una riga d'acquisto resta traccia della data,
-- cosi' un articolo gia' "Controllato" torna segnalato anche se il prezzo viene modificato dopo.
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS price_changed_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_purchase_item_price_changed_at() RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $f$
BEGIN
    NEW.price_changed_at := now();
    RETURN NEW;
END;
$f$;

CREATE TRIGGER purchase_item_price_changed
    BEFORE UPDATE OF price ON public.purchase_items
    FOR EACH ROW
    WHEN (OLD.price IS DISTINCT FROM NEW.price)
    EXECUTE FUNCTION public.set_purchase_item_price_changed_at();
