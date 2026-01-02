-- =====================================================
-- FIX SECURITY: Impedire cancellazione utenti Admin
-- =====================================================
-- Obiettivo: Un utente con ruolo 'admin' non può essere cancellato direttamente.
-- Deve prima essere demansionato a 'user' o 'operativo'.
-- Questo previene cancellazioni accidentali dell'ultimo admin o di account critici.
-- =====================================================

-- 1. Creazione funzione trigger
CREATE OR REPLACE FUNCTION public.prevent_admin_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'admin' THEN
    RAISE EXCEPTION 'Non puoi cancellare un utente Amministratore. Modifica prima il suo ruolo in User o Operativo.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 2. Applicazione trigger alla tabella profiles
DROP TRIGGER IF EXISTS check_admin_deletion ON public.profiles;

CREATE TRIGGER check_admin_deletion
BEFORE DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_admin_deletion();
