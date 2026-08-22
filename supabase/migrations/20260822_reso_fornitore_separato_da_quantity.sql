-- Il reso al fornitore non deve piu' modificare quantity/pieces della riga
-- (che restano sempre uguali a quanto arrivato con la bolla, coerenti con la
-- fattura del fornitore). Il reso resta tracciato con returned_quantity/
-- returned_pieces/returned_at (gia' esistenti) + il nuovo returned_price
-- (prezzo del reso, inserito manualmente, puo' differire dal prezzo di riga
-- es. per il trasporto applicato).

ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS returned_price NUMERIC;

-- purchase_batch_availability: il disponibile per lotto ora si calcola
-- sottraendo esplicitamente il reso da pi.quantity/pi.pieces, invece di
-- aspettarsi che siano gia' ridotti. original_quantity/original_pieces
-- restano invariati (quanto e' arrivato con la bolla).
CREATE OR REPLACE VIEW public.purchase_batch_availability WITH (security_invoker = true) AS
SELECT
    pi.id as purchase_item_id,
    pi.item_id,
    pi.purchase_id as purchase_id,
    p.delivery_note_number as purchase_ref,
    p.delivery_note_date as purchase_date,
    pi.price as unit_price,
    pi.coefficient as coefficient,
    pi.quantity as original_quantity,

    LEAST(
        (CASE WHEN COALESCE(pi.job_id, p.job_id) IS NOT NULL THEN 0 ELSE (pi.quantity - COALESCE(pi.returned_quantity, 0)) END)
        - COALESCE((
            SELECT SUM(dni.quantity)
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = pi.id
            AND dn.type IN ('exit', 'sale')
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
        ), 0) + COALESCE((
            SELECT SUM(dni.quantity)
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = pi.id
            AND dn.type = 'entry'
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
        ), 0),
        (pi.quantity - COALESCE(pi.returned_quantity, 0))
    ) as remaining_quantity,

    pi.pieces as original_pieces,

    LEAST(
        (CASE WHEN COALESCE(pi.job_id, p.job_id) IS NOT NULL THEN 0 ELSE (pi.pieces - COALESCE(pi.returned_pieces, 0)) END)
        - COALESCE((
            SELECT SUM(dni.pieces)
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = pi.id
            AND dn.type IN ('exit', 'sale')
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
        ), 0) + COALESCE((
            SELECT SUM(dni.pieces)
            FROM public.delivery_note_items dni
            JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dni.purchase_item_id = pi.id
            AND dn.type = 'entry'
            AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)
        ), 0),
        (pi.pieces - COALESCE(pi.returned_pieces, 0))
    ) as remaining_pieces,

    civ.warehouse_id as current_warehouse_id,
    civ.warehouse_name as current_warehouse_name,
    civ.warehouse_is_primary as current_warehouse_is_primary

FROM public.purchase_items pi
JOIN public.purchases p ON pi.purchase_id = p.id
LEFT JOIN public.purchase_item_current_warehouse civ ON civ.purchase_item_id = pi.id
WHERE
    p.deleted_at IS NULL
    AND p.order_type = 'purchase'

    AND (
        LEAST(
            (CASE WHEN COALESCE(pi.job_id, p.job_id) IS NOT NULL THEN 0 ELSE (pi.quantity - COALESCE(pi.returned_quantity, 0)) END)
            - COALESCE((SELECT SUM(dni.quantity) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type IN ('exit', 'sale') AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0)
            + COALESCE((SELECT SUM(dni.quantity) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type = 'entry' AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0),
            (pi.quantity - COALESCE(pi.returned_quantity, 0))
        ) > 0.001

        OR LEAST(
            (CASE WHEN COALESCE(pi.job_id, p.job_id) IS NOT NULL THEN 0 ELSE (pi.pieces - COALESCE(pi.returned_pieces, 0)) END)
            - COALESCE((SELECT SUM(dni.pieces) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type IN ('exit', 'sale') AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0)
            + COALESCE((SELECT SUM(dni.pieces) FROM public.delivery_note_items dni JOIN public.delivery_notes dn ON dni.delivery_note_id = dn.id WHERE dni.purchase_item_id = pi.id AND dn.type = 'entry' AND (dni.is_fictitious IS FALSE OR dni.is_fictitious IS NULL)), 0),
            (pi.pieces - COALESCE(pi.returned_pieces, 0))
        ) > 0.001

        OR COALESCE(pi.job_id, p.job_id) IS NOT NULL
    );

GRANT SELECT ON public.purchase_batch_availability TO authenticated;

-- handle_purchase_item_change: rimuove il clamp GREATEST(0,...) legato al
-- vecchio "applica reso" (che mascherava silenziosamente lo squilibrio
-- quando il lotto era gia' uscito altrove) e aggiunge un blocco dedicato
-- che sposta SOLO il magazzino generale (mai la commessa) in base al diff
-- di returned_quantity/returned_pieces. Un reso e' ammesso solo su
-- materiale ancora a magazzino (validato lato applicazione prima del
-- salvataggio), quindi qui non serve piu' alcun clamp: se qualcosa non
-- torna deve fallire in modo esplicito, non essere assorbito in silenzio.
CREATE OR REPLACE FUNCTION public.handle_purchase_item_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_order_type TEXT;
    v_purchase_job_id UUID;
    v_old_pieces NUMERIC;
    v_new_pieces NUMERIC;
    v_old_job_id UUID;
    v_new_job_id UUID;
    v_old_returned_qty NUMERIC;
    v_new_returned_qty NUMERIC;
    v_old_returned_pieces NUMERIC;
    v_new_returned_pieces NUMERIC;
    v_returned_diff NUMERIC;
    v_returned_pieces_diff NUMERIC;
BEGIN
    IF current_setting('app.skip_inventory_on_delete', true) = 'true' THEN
        RETURN NULL;
    END IF;

    IF TG_OP = 'DELETE' THEN
        SELECT order_type, job_id INTO v_order_type, v_purchase_job_id FROM purchases WHERE id = OLD.purchase_id;
        v_old_job_id := COALESCE(OLD.job_id, v_purchase_job_id);
    ELSE
        SELECT order_type, job_id INTO v_order_type, v_purchase_job_id FROM purchases WHERE id = NEW.purchase_id;
        v_new_job_id := COALESCE(NEW.job_id, v_purchase_job_id);
        IF TG_OP = 'UPDATE' THEN
            v_old_job_id := COALESCE(OLD.job_id, v_purchase_job_id);
        END IF;
    END IF;

    IF v_order_type = 'order' THEN
        RETURN NULL;
    END IF;

    IF TG_OP = 'INSERT' THEN
        v_new_pieces := COALESCE(NEW.pieces, 0);
        IF v_new_job_id IS NULL THEN
            UPDATE inventory SET quantity = quantity + NEW.quantity, pieces = pieces + v_new_pieces WHERE id = NEW.item_id;
        ELSE
            INSERT INTO job_inventory (job_id, item_id, quantity, pieces)
            VALUES (v_new_job_id, NEW.item_id, NEW.quantity, v_new_pieces)
            ON CONFLICT (job_id, item_id) DO UPDATE SET
                quantity = job_inventory.quantity + EXCLUDED.quantity,
                pieces = job_inventory.pieces + EXCLUDED.pieces,
                updated_at = now();
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        v_old_pieces := COALESCE(OLD.pieces, 0);
        IF v_old_job_id IS NULL THEN
            UPDATE inventory SET quantity = quantity - OLD.quantity, pieces = pieces - v_old_pieces WHERE id = OLD.item_id;
        ELSE
            UPDATE job_inventory SET quantity = quantity - OLD.quantity, pieces = pieces - v_old_pieces, updated_at = now()
            WHERE job_id = v_old_job_id AND item_id = OLD.item_id;
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        v_old_pieces := COALESCE(OLD.pieces, 0);
        v_new_pieces := COALESCE(NEW.pieces, 0);

        IF v_old_job_id IS NOT DISTINCT FROM v_new_job_id THEN
            IF OLD.quantity IS DISTINCT FROM NEW.quantity OR v_old_pieces IS DISTINCT FROM v_new_pieces THEN
                IF v_new_job_id IS NULL THEN
                    UPDATE inventory SET quantity = quantity - OLD.quantity + NEW.quantity, pieces = pieces - v_old_pieces + v_new_pieces WHERE id = NEW.item_id;
                ELSE
                    UPDATE job_inventory SET quantity = quantity - OLD.quantity + NEW.quantity, pieces = pieces - v_old_pieces + v_new_pieces, updated_at = now()
                    WHERE job_id = v_new_job_id AND item_id = NEW.item_id;
                END IF;
            END IF;
        ELSE
            IF v_old_job_id IS NULL THEN
                UPDATE inventory SET quantity = quantity - OLD.quantity, pieces = pieces - v_old_pieces WHERE id = OLD.item_id;
            ELSE
                UPDATE job_inventory SET quantity = quantity - OLD.quantity, pieces = pieces - v_old_pieces, updated_at = now()
                WHERE job_id = v_old_job_id AND item_id = OLD.item_id;
            END IF;

            IF v_new_job_id IS NULL THEN
                UPDATE inventory SET quantity = quantity + NEW.quantity, pieces = pieces + v_new_pieces WHERE id = NEW.item_id;
            ELSE
                INSERT INTO job_inventory (job_id, item_id, quantity, pieces)
                VALUES (v_new_job_id, NEW.item_id, NEW.quantity, v_new_pieces)
                ON CONFLICT (job_id, item_id) DO UPDATE SET
                    quantity = job_inventory.quantity + EXCLUDED.quantity,
                    pieces = job_inventory.pieces + EXCLUDED.pieces,
                    updated_at = now();
            END IF;
        END IF;

        v_old_returned_qty := COALESCE(OLD.returned_quantity, 0);
        v_new_returned_qty := COALESCE(NEW.returned_quantity, 0);
        v_old_returned_pieces := COALESCE(OLD.returned_pieces, 0);
        v_new_returned_pieces := COALESCE(NEW.returned_pieces, 0);
        IF v_old_returned_qty IS DISTINCT FROM v_new_returned_qty OR v_old_returned_pieces IS DISTINCT FROM v_new_returned_pieces THEN
            v_returned_diff := v_new_returned_qty - v_old_returned_qty;
            v_returned_pieces_diff := v_new_returned_pieces - v_old_returned_pieces;
            UPDATE inventory SET quantity = quantity - v_returned_diff, pieces = pieces - v_returned_pieces_diff WHERE id = NEW.item_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$function$;
