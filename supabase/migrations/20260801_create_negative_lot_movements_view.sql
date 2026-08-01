-- Vista per la pagina admin "Anomalie": righe di bolle collegate (per tracciabilità
-- lotto) a un purchase_item la cui quantità/pezzi residui sono scesi sotto zero.
-- Caso tipico: una riga è stata agganciata a un acquisto fatto direttamente per
-- un'altra commessa (che quindi parte già a scorta 0 per il magazzino generale),
-- vedi 20260719c e 20260731 per due correzioni già applicate manualmente.
CREATE OR REPLACE VIEW public.negative_lot_movements AS
SELECT
    pba.purchase_item_id,
    pba.item_id,
    i.code,
    i.name,
    i.unit,
    pba.purchase_ref,
    pba.purchase_date,
    pba.remaining_quantity,
    pba.remaining_pieces,
    dni.id AS delivery_note_item_id,
    dn.id AS delivery_note_id,
    dn.number AS delivery_note_number,
    dn.date AS delivery_note_date,
    dn.type AS delivery_note_type,
    dni.quantity AS item_quantity,
    dni.pieces AS item_pieces
FROM public.purchase_batch_availability pba
JOIN public.inventory i ON i.id = pba.item_id
JOIN public.delivery_note_items dni ON dni.purchase_item_id = pba.purchase_item_id
JOIN public.delivery_notes dn ON dn.id = dni.delivery_note_id
WHERE pba.remaining_quantity < 0 OR pba.remaining_pieces < 0;

GRANT SELECT ON public.negative_lot_movements TO anon, authenticated;
