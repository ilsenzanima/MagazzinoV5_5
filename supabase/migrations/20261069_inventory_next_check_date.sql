-- Attrezzature: data della prossima verifica o revisione (la posizione riusa la colonna location)
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS next_check_date date;
COMMENT ON COLUMN public.inventory.next_check_date IS 'Attrezzature: data della prossima verifica o revisione';
