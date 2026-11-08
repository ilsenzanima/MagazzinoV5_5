-- Operai da conteggiare nei «giorni con presenze da segnare» (si gestisce da Strumenti admin > Presenze operai)
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS attendance_check boolean NOT NULL DEFAULT true;
-- I due operai che non sono sempre in squadra non vanno conteggiati
UPDATE public.workers SET attendance_check = false WHERE deleted_at IS NULL AND ((first_name = 'Paolo' AND last_name = 'Zecchin') OR (first_name = 'Matteo' AND last_name = 'Bertolin'));
