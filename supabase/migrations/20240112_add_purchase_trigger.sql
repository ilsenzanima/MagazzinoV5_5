-- Trigger to update inventory when purchase items are added/modified/deleted
CREATE OR REPLACE FUNCTION public.handle_purchase_item_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.inventory
    SET quantity = quantity + NEW.quantity
    WHERE id = NEW.item_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.inventory
    SET quantity = quantity - OLD.quantity
    WHERE id = OLD.item_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.inventory
    SET quantity = quantity - OLD.quantity + NEW.quantity
    WHERE id = NEW.item_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_purchase_item_change ON public.purchase_items;

-- Create Trigger
CREATE TRIGGER on_purchase_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_purchase_item_change();
