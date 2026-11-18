-- Furgoni: un elenco permanente di materiale per ogni furgone, da spostare poi su una nota di carico
-- (esistente o nuova). Non scarica il magazzino, come le note di carico.
--
-- Per annullare:
--   DROP FUNCTION public.move_van_items_to_note(uuid[], uuid);
--   DROP TABLE public.van_items;
--   DROP TABLE public.vans;

CREATE TABLE IF NOT EXISTS public.vans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    plate TEXT,
    notes TEXT,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.van_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    van_id UUID NOT NULL REFERENCES public.vans(id) ON DELETE CASCADE,
    inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
    pieces NUMERIC(10, 2),
    quantity NUMERIC(12, 4) NOT NULL,
    coefficient NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- lo stesso articolo compare una sola volta per furgone: aggiungerlo di nuovo somma le quantità
    UNIQUE (van_id, inventory_id)
);

CREATE INDEX IF NOT EXISTS idx_van_items_van_id ON public.van_items(van_id);
CREATE INDEX IF NOT EXISTS idx_van_items_inventory_id ON public.van_items(inventory_id);

ALTER TABLE public.vans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vans readable by authenticated" ON public.vans
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Van items readable by authenticated" ON public.van_items
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Vans writable by admin, responsabile, operativo" ON public.vans
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role IN ('admin', 'responsabile', 'operativo')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role IN ('admin', 'responsabile', 'operativo')));

CREATE POLICY "Van items writable by admin, responsabile, operativo" ON public.van_items
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role IN ('admin', 'responsabile', 'operativo')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role IN ('admin', 'responsabile', 'operativo')));

-- Sposta righe del furgone su una nota di carico da processare: se la nota ha già l'articolo (non ancora spuntato)
-- le quantità si sommano, altrimenti si crea la riga. Le righe escono dal furgone. Tutto in un colpo solo.
-- SECURITY INVOKER: valgono i permessi di chi la chiama.
CREATE OR REPLACE FUNCTION public.move_van_items_to_note(p_item_ids UUID[], p_note_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    existing UUID;
    moved INTEGER := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM load_notes WHERE id = p_note_id AND status = 'pending' AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'La nota di carico non esiste o non è più da processare';
    END IF;

    FOR r IN SELECT * FROM van_items WHERE id = ANY(p_item_ids) FOR UPDATE LOOP
        SELECT id INTO existing FROM load_note_items
        WHERE load_note_id = p_note_id AND inventory_id = r.inventory_id AND NOT is_checked
        LIMIT 1;

        IF existing IS NOT NULL THEN
            UPDATE load_note_items
            SET quantity = quantity + r.quantity,
                pieces = CASE WHEN pieces IS NULL AND r.pieces IS NULL THEN NULL ELSE COALESCE(pieces, 0) + COALESCE(r.pieces, 0) END
            WHERE id = existing;
        ELSE
            INSERT INTO load_note_items (load_note_id, inventory_id, pieces, quantity, coefficient)
            VALUES (p_note_id, r.inventory_id, r.pieces, r.quantity, r.coefficient);
        END IF;

        DELETE FROM van_items WHERE id = r.id;
        moved := moved + 1;
    END LOOP;

    RETURN moved;
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_van_items_to_note(UUID[], UUID) TO authenticated;
