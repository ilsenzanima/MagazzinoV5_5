-- 1. Update trigger function to handle UPDATE
CREATE OR REPLACE FUNCTION public.handle_delivery_note_item_change()
RETURNS TRIGGER AS $$
DECLARE
  note_type TEXT;
BEGIN
  -- Get the type from the parent delivery note
  SELECT type INTO note_type
  FROM public.delivery_notes
  WHERE id = COALESCE(NEW.delivery_note_id, OLD.delivery_note_id);

  IF TG_OP = 'INSERT' THEN
    IF note_type = 'entry' THEN
      UPDATE public.inventory
      SET quantity = quantity + NEW.quantity
      WHERE id = NEW.inventory_id;
    ELSIF note_type IN ('exit', 'sale') THEN
      UPDATE public.inventory
      SET quantity = quantity - NEW.quantity
      WHERE id = NEW.inventory_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Reverse OLD, Apply NEW
    IF note_type = 'entry' THEN
      UPDATE public.inventory
      SET quantity = quantity - OLD.quantity + NEW.quantity
      WHERE id = NEW.inventory_id;
    ELSIF note_type IN ('exit', 'sale') THEN
      UPDATE public.inventory
      SET quantity = quantity + OLD.quantity - NEW.quantity
      WHERE id = NEW.inventory_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- Reverse the operation
    IF note_type = 'entry' THEN
      UPDATE public.inventory
      SET quantity = quantity - OLD.quantity
      WHERE id = OLD.inventory_id;
    ELSIF note_type IN ('exit', 'sale') THEN
      UPDATE public.inventory
      SET quantity = quantity + OLD.quantity
      WHERE id = OLD.inventory_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger definition to include UPDATE
DROP TRIGGER IF EXISTS on_delivery_note_item_change ON public.delivery_note_items;
CREATE TRIGGER on_delivery_note_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_note_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_delivery_note_item_change();

-- 2. Update stock_movements_view to include legacy movements
CREATE OR REPLACE VIEW public.stock_movements_view AS
SELECT
    pi.id,
    pi.created_at as date,
    'purchase' as type,
    pi.quantity as quantity, -- Purchases always add stock
    p.delivery_note_number as reference,
    pi.item_id,
    p.created_by as user_id,
    pi.pieces,
    pi.coefficient,
    p.notes
FROM public.purchase_items pi
JOIN public.purchases p ON pi.purchase_id = p.id

UNION ALL

SELECT
    dni.id,
    dni.created_at as date,
    dn.type, -- 'entry', 'exit', 'sale'
    CASE 
        WHEN dn.type = 'entry' THEN dni.quantity
        ELSE -dni.quantity
    END as quantity,
    dn.number as reference,
    dni.inventory_id as item_id,
    dn.created_by as user_id,
    dni.pieces,
    dni.coefficient,
    dn.notes
FROM public.delivery_note_items dni
JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id

UNION ALL

-- Include legacy movements
SELECT
    m.id,
    m.created_at as date,
    CASE
        WHEN m.type = 'load' THEN 'entry'
        WHEN m.type = 'unload' THEN 'exit'
        ELSE m.type
    END as type,
    CASE 
        WHEN m.type = 'load' THEN m.quantity
        ELSE -m.quantity
    END as quantity,
    m.reference,
    m.item_id,
    m.user_id,
    NULL as pieces,
    NULL as coefficient,
    m.notes
FROM public.movements m;
