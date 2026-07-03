-- Come purchase_items e delivery_note_items, movements e load_note_items devono
-- BLOCCARE l'eliminazione definitiva di un articolo che ha ancora storico (invece
-- di cancellarlo in cascata): erano ON DELETE CASCADE, per cui l'eliminazione
-- definitiva di un articolo dal Cestino (permessa se quantity=0 e nessun lotto
-- residuo, ma senza controllare lo storico) avrebbe silenziosamente cancellato
-- tutti i suoi movimenti storici o le righe delle Note Carico che lo referenziano.

ALTER TABLE movements DROP CONSTRAINT movements_item_id_fkey;
ALTER TABLE movements ADD CONSTRAINT movements_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE RESTRICT;

ALTER TABLE load_note_items DROP CONSTRAINT load_note_items_inventory_id_fkey;
ALTER TABLE load_note_items ADD CONSTRAINT load_note_items_inventory_id_fkey
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE RESTRICT;
