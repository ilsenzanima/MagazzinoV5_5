-- Funzione per hard-delete di un acquisto dal cestino.
-- Usa una variabile di sessione per segnalare al trigger
-- handle_purchase_item_change di NON aggiustare inventory
-- (l'inventory è già stato aggiustato al momento del soft-delete).

-- 1. Modifica il trigger esistente per rispettare il flag di sessione
CREATE OR REPLACE FUNCTION public.handle_purchase_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Skip aggiustamento inventario se richiesto esplicitamente
    -- (usato durante hard-delete da cestino per evitare doppio conteggio)
    IF current_setting('app.skip_inventory_on_delete', true) = 'true' THEN
        RETURN NULL;
    END IF;

    IF TG_OP = 'INSERT' THEN
        UPDATE inventory SET quantity = quantity + NEW.quantity WHERE id = NEW.item_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE inventory SET quantity = quantity - OLD.quantity WHERE id = OLD.item_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.quantity IS DISTINCT FROM NEW.quantity THEN
            UPDATE inventory SET quantity = quantity - OLD.quantity + NEW.quantity WHERE id = NEW.item_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

-- 2. Funzione che esegue l'hard-delete disabilitando il trigger inventario
--    (l'inventario è già stato corretto al soft-delete)
CREATE OR REPLACE FUNCTION public.hard_delete_purchase(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Segnala al trigger di non toccare l'inventario
    SET LOCAL app.skip_inventory_on_delete = 'true';
    DELETE FROM purchases WHERE id = p_id;
    -- Il CASCADE elimina purchase_items senza modificare inventory
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hard_delete_purchase(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.hard_delete_purchase(UUID) TO authenticated;
