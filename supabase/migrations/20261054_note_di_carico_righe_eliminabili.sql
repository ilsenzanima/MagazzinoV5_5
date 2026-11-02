-- Modificando una nota di carico, le righe tolte si cancellavano solo se l'utente era admin: per un operativo la
-- cancellazione non riusciva in silenzio e le righe si duplicavano. Ora la cancellazione delle righe è permessa
-- anche agli operativi (come già la modifica della nota).
--
-- Per annullare:
--   DROP POLICY "Load note items deletable by admin and operativo" ON public.load_note_items;
--   (resta la policy «Load note items deletable by admin»)

CREATE POLICY "Load note items deletable by admin and operativo"
  ON public.load_note_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid()) AND profiles.role IN ('admin', 'operativo')
  ));
