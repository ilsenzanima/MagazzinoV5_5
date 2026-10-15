-- Controllo acquisti (strumento Admin):
--  * pack_quantity: quantita' normale per confezione/scatola, nell'unita' dell'articolo
--    (es. Promastop-W: 18 ML per scatola). Serve a segnalare lotti il cui prezzo o la cui
--    quantita' non tornano con la confezione.
--  * price_check_ok_at / price_check_ok_by: l'articolo e' stato controllato da un admin e le
--    differenze di prezzo tra i lotti esistenti sono accettate. Solo i lotti inseriti dopo
--    quella data tornano a essere segnalati.
ALTER TABLE public.inventory
    ADD COLUMN IF NOT EXISTS pack_quantity numeric CHECK (pack_quantity IS NULL OR pack_quantity > 0),
    ADD COLUMN IF NOT EXISTS price_check_ok_at timestamptz,
    ADD COLUMN IF NOT EXISTS price_check_ok_by uuid;
