-- Il reso su una riga acquisto puo' riguardare materiale che, sul piano
-- contabile del magazzino/cantiere, risulta gia' a quantita' 0 (perche' era
-- gia' stato scaricato altrove con una bolla, anche se magari non e' mai
-- arrivato fisicamente a destinazione). In quel caso il trigger generico
-- handle_purchase_item_change tentava comunque di sottrarre l'intera
-- quantita' resa da inventory/job_inventory, violando il vincolo
-- "quantity >= 0" e bloccando il reso.
--
-- Per un reso conta il valore puro dell'acquisto, non dove si trova
-- fisicamente il materiale: quando si applica un reso (transizione di
-- returned_at da NULL a valorizzato) la sincronizzazione con
-- inventory/job_inventory si ferma a zero invece di fallire. Tutti gli
-- altri casi (modifiche normali di riga, cambio commessa, cancellazione
-- del reso) restano invariati.

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
    v_is_return_apply BOOLEAN;
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
        v_is_return_apply := (NEW.returned_at IS NOT NULL AND OLD.returned_at IS NULL);

        IF v_old_job_id IS NOT DISTINCT FROM v_new_job_id THEN
            IF OLD.quantity IS DISTINCT FROM NEW.quantity OR v_old_pieces IS DISTINCT FROM v_new_pieces THEN
                IF v_new_job_id IS NULL THEN
                    IF v_is_return_apply THEN
                        UPDATE inventory SET
                            quantity = GREATEST(0, quantity - OLD.quantity + NEW.quantity),
                            pieces = GREATEST(0, pieces - v_old_pieces + v_new_pieces)
                        WHERE id = NEW.item_id;
                    ELSE
                        UPDATE inventory SET quantity = quantity - OLD.quantity + NEW.quantity, pieces = pieces - v_old_pieces + v_new_pieces WHERE id = NEW.item_id;
                    END IF;
                ELSE
                    IF v_is_return_apply THEN
                        UPDATE job_inventory SET
                            quantity = GREATEST(0, quantity - OLD.quantity + NEW.quantity),
                            pieces = GREATEST(0, pieces - v_old_pieces + v_new_pieces),
                            updated_at = now()
                        WHERE job_id = v_new_job_id AND item_id = NEW.item_id;
                    ELSE
                        UPDATE job_inventory SET quantity = quantity - OLD.quantity + NEW.quantity, pieces = pieces - v_old_pieces + v_new_pieces, updated_at = now()
                        WHERE job_id = v_new_job_id AND item_id = NEW.item_id;
                    END IF;
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
    END IF;
    RETURN NULL;
END;
$function$;
