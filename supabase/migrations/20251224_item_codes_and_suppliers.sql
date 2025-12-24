-- 1. Change default Item Code to UUID
ALTER TABLE public.inventory 
ALTER COLUMN code SET DEFAULT gen_random_uuid()::text;

-- Optional: If you want to ensure no "holes" in future, UUID guarantees uniqueness.
-- We do not change existing codes to avoid confusion.

-- 2. Create Inventory Supplier Codes table
CREATE TABLE IF NOT EXISTS public.inventory_supplier_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    inventory_id UUID REFERENCES public.inventory(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT, -- Optional: Free text if supplier not in DB
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.inventory_supplier_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supplier codes viewable by authenticated" 
ON public.inventory_supplier_codes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Supplier codes modifiable by authenticated" 
ON public.inventory_supplier_codes FOR ALL TO authenticated USING (true);

-- 3. Update stock_movements_view to ensure job_id is clear (already done in previous steps, but ensuring View is robust)
-- The view definition from previous context seems correct, but we rely on api.ts to fetch it.
