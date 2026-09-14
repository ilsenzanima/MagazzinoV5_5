-- La policy DELETE su job_sal_costs (righe "Altri Costi" della scheda economico di una
-- commessa) era rimasta ad ammettere solo il ruolo Admin, mentre INSERT e UPDATE sulla
-- stessa tabella gia' ammettono anche Operativo. Questo impediva a un utente Operativo di
-- eliminare una riga di costo che aveva creato lui stesso, senza alcun errore visibile in UI
-- (il bottone di eliminazione resta cliccabile, la DELETE viene solo rifiutata da RLS).
-- Stesso pattern gia' applicato ad altre tabelle in 20260713_operativo_delete_permissions.sql.

DROP POLICY IF EXISTS "Admin can delete sal costs" ON public.job_sal_costs;
CREATE POLICY "Admin/Operativo can delete sal costs" ON public.job_sal_costs
    FOR DELETE TO authenticated USING ((select public.get_my_role()) IN ('admin', 'operativo'));
