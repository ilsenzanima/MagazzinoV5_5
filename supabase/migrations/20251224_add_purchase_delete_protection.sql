-- Trigger to prevent deletion of Purchases if they have been used in Delivery Notes

CREATE OR REPLACE FUNCTION public.check_purchase_deletion_safety()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if any item from this purchase has been used in a delivery note
  IF EXISTS (
    SELECT 1 
    FROM public.delivery_note_items dni
    JOIN public.purchase_items pi ON dni.purchase_item_id = pi.id
    WHERE pi.purchase_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Impossibile eliminare l''acquisto: alcuni articoli sono già stati movimentati in bolle di uscita/vendita. Eliminare prima le bolle collegate.';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_purchase_deletion_safety_trigger ON public.purchases;

CREATE TRIGGER check_purchase_deletion_safety_trigger
  BEFORE DELETE ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.check_purchase_deletion_safety();
