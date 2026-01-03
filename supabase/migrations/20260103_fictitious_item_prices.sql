-- Tabella per salvare prezzi manuali articoli fittizi per commessa
-- Permette di assegnare un valore stimato agli articoli fittizi in cantiere

CREATE TABLE IF NOT EXISTS public.fictitious_item_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, item_id)
);

-- Indici per performance
CREATE INDEX idx_fictitious_prices_job ON public.fictitious_item_prices(job_id);
CREATE INDEX idx_fictitious_prices_item ON public.fictitious_item_prices(item_id);

-- RLS Policies
ALTER TABLE public.fictitious_item_prices ENABLE ROW LEVEL SECURITY;

-- Policy: Tutti possono leggere
CREATE POLICY "Anyone can read fictitious prices"
    ON public.fictitious_item_prices
    FOR SELECT
    USING (true);

-- Policy: Solo admin e operativo possono inserire/aggiornare
CREATE POLICY "Admin and operativo can insert fictitious prices"
    ON public.fictitious_item_prices
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'operativo')
        )
    );

CREATE POLICY "Admin and operativo can update fictitious prices"
    ON public.fictitious_item_prices
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'operativo')
        )
    );

-- Policy: Solo admin può cancellare
CREATE POLICY "Only admin can delete fictitious prices"
    ON public.fictitious_item_prices
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION public.update_fictitious_price_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_fictitious_price_timestamp
    BEFORE UPDATE ON public.fictitious_item_prices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_fictitious_price_timestamp();

COMMENT ON TABLE public.fictitious_item_prices IS 
'Prezzi manuali per articoli fittizi in cantiere. Permette di assegnare un valore stimato agli articoli fittizi che non hanno un prezzo di acquisto reale.';
