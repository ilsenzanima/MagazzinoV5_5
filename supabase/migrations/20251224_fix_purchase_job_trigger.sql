-- Fix Purchase Logic: Direct-to-Site purchases should NOT increase Main Inventory

-- 1. Update Recalculate Function to exclude Job Purchases
CREATE OR REPLACE FUNCTION public.recalculate_inventory_item(target_item_id UUID)
RETURNS VOID AS $$
DECLARE
    total_purchased NUMERIC(10,2) := 0;
    total_delivered NUMERIC(10,2) := 0;
    total_legacy NUMERIC(10,2) := 0;
    final_quantity NUMERIC(10,2) := 0;
BEGIN
    -- Sum Purchases (ONLY those NOT linked to a job)
    SELECT COALESCE(SUM(pi.quantity), 0) INTO total_purchased
    FROM public.purchase_items pi
    JOIN public.purchases p ON pi.purchase_id = p.id
    WHERE pi.item_id = target_item_id
    AND p.job_id IS NULL; -- KEY CHANGE: Exclude direct-to-site purchases

    -- Sum Delivery Notes
    -- Entry = + (Back to warehouse)
    -- Exit/Sale = - (Out of warehouse)
    -- EXCLUDE Fictitious items
    SELECT COALESCE(SUM(
        CASE 
            WHEN dn.type = 'entry' THEN dni.quantity
            WHEN dn.type IN ('exit', 'sale') THEN -dni.quantity
            ELSE 0
        END
    ), 0) INTO total_delivered
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
    WHERE dni.inventory_id = target_item_id
    AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL);

    -- Sum Legacy Movements
    SELECT COALESCE(SUM(
        CASE 
            WHEN type = 'load' THEN quantity
            WHEN type = 'unload' THEN -quantity
            ELSE 0
        END
    ), 0) INTO total_legacy
    FROM public.movements
    WHERE item_id = target_item_id;

    -- Final
    final_quantity := total_purchased + total_delivered + total_legacy;

    -- Update Inventory
    UPDATE public.inventory
    SET quantity = final_quantity
    WHERE id = target_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Purchase Trigger to handle Job Inventory
CREATE OR REPLACE FUNCTION public.handle_purchase_item_change()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Get job_id from parent purchase
  IF TG_OP = 'DELETE' THEN
    SELECT job_id INTO v_job_id FROM public.purchases WHERE id = OLD.purchase_id;
  ELSE
    SELECT job_id INTO v_job_id FROM public.purchases WHERE id = NEW.purchase_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_job_id IS NOT NULL THEN
      -- Direct to Job Site -> Update Job Inventory
      INSERT INTO public.job_inventory (job_id, item_id, quantity)
      VALUES (v_job_id, NEW.item_id, NEW.quantity)
      ON CONFLICT (job_id, item_id) 
      DO UPDATE SET 
        quantity = job_inventory.quantity + EXCLUDED.quantity,
        updated_at = now();
    ELSE
      -- To Warehouse -> Update Main Inventory
      UPDATE public.inventory
      SET quantity = quantity + NEW.quantity
      WHERE id = NEW.item_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF v_job_id IS NOT NULL THEN
      -- Remove from Job Site
      UPDATE public.job_inventory
      SET quantity = quantity - OLD.quantity,
          updated_at = now()
      WHERE job_id = v_job_id AND item_id = OLD.item_id;
    ELSE
      -- Remove from Warehouse
      UPDATE public.inventory
      SET quantity = quantity - OLD.quantity
      WHERE id = OLD.item_id;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Simplified update logic (assuming job_id didn't change)
    IF v_job_id IS NOT NULL THEN
       UPDATE public.job_inventory
       SET quantity = quantity - OLD.quantity + NEW.quantity,
           updated_at = now()
       WHERE job_id = v_job_id AND item_id = NEW.item_id;
    ELSE
       UPDATE public.inventory
       SET quantity = quantity - OLD.quantity + NEW.quantity
       WHERE id = NEW.item_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-apply Trigger
DROP TRIGGER IF EXISTS on_purchase_item_change ON public.purchase_items;
CREATE TRIGGER on_purchase_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_purchase_item_change();

-- 4. Update Availability View to exclude Direct-to-Site purchases
CREATE OR REPLACE VIEW public.purchase_batch_availability AS
SELECT 
    pi.id as purchase_item_id,
    pi.item_id,
    p.delivery_note_number as purchase_ref,
    p.created_at as purchase_date,
    pi.price as unit_price,
    pi.coefficient as coefficient,
    pi.quantity as original_quantity,
    pi.quantity - COALESCE((
        SELECT SUM(dni.quantity)
        FROM public.delivery_note_items dni
        JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
        WHERE dni.purchase_item_id = pi.id
        AND dn.type IN ('exit', 'sale')
        AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
    ), 0) as remaining_quantity,
    pi.pieces as original_pieces,
    pi.pieces - COALESCE((
        SELECT SUM(dni.pieces)
        FROM public.delivery_note_items dni
        JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
        WHERE dni.purchase_item_id = pi.id
        AND dn.type IN ('exit', 'sale')
        AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
    ), 0) as remaining_pieces
FROM public.purchase_items pi
JOIN public.purchases p ON pi.purchase_id = p.id
WHERE p.job_id IS NULL -- Exclude direct-to-site purchases
AND (
    pi.pieces - COALESCE((
        SELECT SUM(dni.pieces)
        FROM public.delivery_note_items dni
        JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
        WHERE dni.purchase_item_id = pi.id
        AND dn.type IN ('exit', 'sale')
        AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
    ), 0)
) > 0.001;

GRANT SELECT ON public.purchase_batch_availability TO authenticated;

-- 5. Recalculate ALL inventory items to fix existing data
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.inventory LOOP
        PERFORM public.recalculate_inventory_item(r.id);
    END LOOP;
END;
$$;
