-- Trigger che aggiusta inventory.quantity quando un acquisto viene
-- soft-deleted (deleted_at NULL→valore) o ripristinato (valore→NULL).
-- Questo mantiene la coerenza con il trigger handle_purchase_item_change
-- che agisce solo su INSERT/DELETE fisici di purchase_items.

CREATE OR REPLACE FUNCTION public.handle_purchase_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Soft-delete: sottrae le quantità dall'inventario
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        UPDATE inventory i
        SET quantity = i.quantity - pi.quantity
        FROM purchase_items pi
        WHERE pi.purchase_id = NEW.id
          AND i.id = pi.item_id;
    END IF;

    -- Ripristino: aggiunge le quantità all'inventario
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        UPDATE inventory i
        SET quantity = i.quantity + pi.quantity
        FROM purchase_items pi
        WHERE pi.purchase_id = NEW.id
          AND i.id = pi.item_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_purchase_soft_delete ON public.purchases;

CREATE TRIGGER on_purchase_soft_delete
    AFTER UPDATE OF deleted_at ON public.purchases
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_purchase_soft_delete();
