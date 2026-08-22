-- Se in uno stesso salvataggio cambiano sia quantity/pieces della riga sia
-- returned_quantity/returned_pieces (es. si riduce la quantita' e questo
-- storna automaticamente un reso che non avrebbe piu' senso), il trigger
-- precedente faceva due UPDATE separati sulla stessa riga di inventory. Il
-- vincolo di non-negativita' viene controllato subito dopo OGNI UPDATE (non
-- e' deferred): se le due variazioni si compensano ma la prima, presa da
-- sola, porterebbe la giacenza sotto zero, il salvataggio falliva anche se
-- il risultato finale sarebbe stato corretto. Le due variazioni vengono ora
-- combinate in un solo UPDATE quando riguardano entrambe il magazzino
-- generale (caso comune: riga non assegnata a commessa).
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
        v_returned_diff := COALESCE(NEW.returned_quantity, 0) - COALESCE(OLD.returned_quantity, 0);
        v_returned_pieces_diff := COALESCE(NEW.returned_pieces, 0) - COALESCE(OLD.returned_pieces, 0);

        IF v_old_job_id IS NOT DISTINCT FROM v_new_job_id THEN
            IF v_new_job_id IS NULL THEN
                IF OLD.quantity IS DISTINCT FROM NEW.quantity OR v_old_pieces IS DISTINCT FROM v_new_pieces
                   OR v_returned_diff <> 0 OR v_returned_pieces_diff <> 0 THEN
                    UPDATE inventory SET
                        quantity = quantity - OLD.quantity + NEW.quantity - v_returned_diff,
                        pieces = pieces - v_old_pieces + v_new_pieces - v_returned_pieces_diff
                    WHERE id = NEW.item_id;
                END IF;
            ELSE
                IF OLD.quantity IS DISTINCT FROM NEW.quantity OR v_old_pieces IS DISTINCT FROM v_new_pieces THEN
                    UPDATE job_inventory SET quantity = quantity - OLD.quantity + NEW.quantity, pieces = pieces - v_old_pieces + v_new_pieces, updated_at = now()
                    WHERE job_id = v_new_job_id AND item_id = NEW.item_id;
                END IF;
                -- Reso su riga assegnata a commessa: caso anomalo (la validazione
                -- applicativa non dovrebbe permetterlo), gestito comunque sul
                -- magazzino generale per non perdere il dato.
                IF v_returned_diff <> 0 OR v_returned_pieces_diff <> 0 THEN
                    UPDATE inventory SET quantity = quantity - v_returned_diff, pieces = pieces - v_returned_pieces_diff WHERE id = NEW.item_id;
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
                UPDATE inventory SET quantity = quantity + NEW.quantity - v_returned_diff, pieces = pieces + v_new_pieces - v_returned_pieces_diff WHERE id = NEW.item_id;
            ELSE
                INSERT INTO job_inventory (job_id, item_id, quantity, pieces)
                VALUES (v_new_job_id, NEW.item_id, NEW.quantity, v_new_pieces)
                ON CONFLICT (job_id, item_id) DO UPDATE SET
                    quantity = job_inventory.quantity + EXCLUDED.quantity,
                    pieces = job_inventory.pieces + EXCLUDED.pieces,
                    updated_at = now();
                IF v_returned_diff <> 0 OR v_returned_pieces_diff <> 0 THEN
                    UPDATE inventory SET quantity = quantity - v_returned_diff, pieces = pieces - v_returned_pieces_diff WHERE id = NEW.item_id;
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NULL;
END;
$function$;
