-- Furgoni: spostare su una nota di carico anche solo una parte della quantità di una riga.
-- p_moves è un array JSON: [{ "id": "<van_item uuid>", "quantity": 3.5, "pieces": 2 }, ...]
-- Se la quantità spostata è pari (o superiore) a quella presente, la riga esce del tutto dal furgone;
-- altrimenti la riga resta sul furgone con la quantità (e i pezzi) rimanenti.
--
-- Per annullare:
--   DROP FUNCTION public.move_van_items_partial(jsonb, uuid);

CREATE OR REPLACE FUNCTION public.move_van_items_partial(p_moves JSONB, p_note_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    m JSONB;
    r RECORD;
    existing UUID;
    move_qty NUMERIC;
    move_pieces NUMERIC;
    whole BOOLEAN;
    moved INTEGER := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM load_notes WHERE id = p_note_id AND status = 'pending' AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'La nota di carico non esiste o non è più da processare';
    END IF;

    FOR m IN SELECT * FROM jsonb_array_elements(p_moves) LOOP
        SELECT * INTO r FROM van_items WHERE id = (m->>'id')::uuid FOR UPDATE;
        IF NOT FOUND THEN
            CONTINUE;
        END IF;

        move_qty := COALESCE((m->>'quantity')::numeric, r.quantity);
        IF move_qty <= 0 THEN
            RAISE EXCEPTION 'La quantità da spostare deve essere maggiore di zero';
        END IF;

        whole := move_qty >= r.quantity;
        IF whole THEN
            move_qty := r.quantity;
            move_pieces := r.pieces;
        ELSE
            move_pieces := CASE WHEN r.pieces IS NULL THEN NULL
                                ELSE LEAST(COALESCE((m->>'pieces')::numeric, r.pieces * move_qty / r.quantity), r.pieces) END;
        END IF;

        SELECT id INTO existing FROM load_note_items
        WHERE load_note_id = p_note_id AND inventory_id = r.inventory_id AND NOT is_checked
        LIMIT 1;

        IF existing IS NOT NULL THEN
            UPDATE load_note_items
            SET quantity = quantity + move_qty,
                pieces = CASE WHEN pieces IS NULL AND move_pieces IS NULL THEN NULL ELSE COALESCE(pieces, 0) + COALESCE(move_pieces, 0) END
            WHERE id = existing;
        ELSE
            INSERT INTO load_note_items (load_note_id, inventory_id, pieces, quantity, coefficient)
            VALUES (p_note_id, r.inventory_id, move_pieces, move_qty, r.coefficient);
        END IF;

        IF whole THEN
            DELETE FROM van_items WHERE id = r.id;
        ELSE
            UPDATE van_items
            SET quantity = quantity - move_qty,
                pieces = CASE WHEN pieces IS NULL THEN NULL ELSE GREATEST(pieces - COALESCE(move_pieces, 0), 0) END
            WHERE id = r.id;
        END IF;

        moved := moved + 1;
    END LOOP;

    RETURN moved;
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_van_items_partial(JSONB, UUID) TO authenticated;
