-- I passcode dei portali ospiti erano leggibili da qualunque utente autenticato (anche ruolo "user").
-- La pagina di gestione e' gia' riservata ad admin/operativo; il portale pubblico legge con service role.
-- Undo: ricreare le due policy con USING (true).
DROP POLICY IF EXISTS "Authenticated users can read guest sites" ON public.guest_sites;
CREATE POLICY "Admin and operativo can read guest sites"
    ON public.guest_sites FOR SELECT TO authenticated
    USING (public.get_my_role() IN ('admin', 'operativo'));

DROP POLICY IF EXISTS "Authenticated users can read guest site jobs" ON public.guest_site_jobs;
CREATE POLICY "Admin and operativo can read guest site jobs"
    ON public.guest_site_jobs FOR SELECT TO authenticated
    USING (public.get_my_role() IN ('admin', 'operativo'));
