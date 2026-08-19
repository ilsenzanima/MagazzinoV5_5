-- Traccia in quale magazzino fisico e' arrivato il materiale di una riga
-- d'acquisto non assegnata a commessa (per default nessuno = magazzino
-- principale). Campo puramente informativo: non tocca inventory/job_inventory.
ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id);
