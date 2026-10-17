-- Silicone: unione di due articoli equivalenti (eseguita in produzione, approvata).
--  * Silicone acrilico Soudal (SIL-SOU-102) confluisce in Silicone acrilico MULTI (SIL-NUL-415):
--    per questi prodotti non serve distinguere la marca
--  * acquisti, righe bolla, assegnazioni a commessa (sommate se la commessa era già presente), analisi costi e
--    codici fornitore passano all'articolo che resta; la giacenza (0) si somma; l'articolo vecchio risulta eliminato
--  * I trigger di acquisti e bolle non spostano le giacenze quando cambia solo l'articolo, quindi le assegnazioni
--    a commessa si uniscono a mano qui sotto.
--  * ripristino: merge_log_silicone_20261034 elenca ogni riga spostata (old_item_id / new_item_id);
--    per riportarle: UPDATE <tabella> SET item_id = old_item_id (inventory_id per bolle e codici fornitore) WHERE id = row_id,
--    e in job_inventory (colonna dettaglio) vanno riportate quantità e righe; poi deleted_at = NULL sull'articolo eliminato.
CREATE TABLE IF NOT EXISTS public.merge_log_silicone_20261034 (
  tabella text, row_id uuid, old_item_id uuid, new_item_id uuid, dettaglio jsonb, moved_at timestamptz DEFAULT now());

DO $$
DECLARE
  keep_id uuid; drop_id uuid;
  r record;
BEGIN
  SELECT id INTO keep_id FROM inventory WHERE code = 'SIL-NUL-415' AND deleted_at IS NULL;
  SELECT id INTO drop_id FROM inventory WHERE code = 'SIL-SOU-102' AND deleted_at IS NULL;
  IF keep_id IS NULL OR drop_id IS NULL THEN RAISE EXCEPTION 'articolo non trovato'; END IF;

  INSERT INTO merge_log_silicone_20261034 (tabella,row_id,old_item_id,new_item_id)
    SELECT 'purchase_items', id, drop_id, keep_id FROM purchase_items WHERE item_id = drop_id;
  UPDATE purchase_items SET item_id = keep_id WHERE item_id = drop_id;

  INSERT INTO merge_log_silicone_20261034 (tabella,row_id,old_item_id,new_item_id)
    SELECT 'delivery_note_items', id, drop_id, keep_id FROM delivery_note_items WHERE inventory_id = drop_id;
  UPDATE delivery_note_items SET inventory_id = keep_id WHERE inventory_id = drop_id;

  INSERT INTO merge_log_silicone_20261034 (tabella,row_id,old_item_id,new_item_id)
    SELECT 'job_cost_analysis_rows', id, drop_id, keep_id FROM job_cost_analysis_rows WHERE item_id = drop_id;
  UPDATE job_cost_analysis_rows SET item_id = keep_id WHERE item_id = drop_id;

  INSERT INTO merge_log_silicone_20261034 (tabella,row_id,old_item_id,new_item_id)
    SELECT 'proposal_cost_analysis_rows', id, drop_id, keep_id FROM proposal_cost_analysis_rows WHERE item_id = drop_id;
  UPDATE proposal_cost_analysis_rows SET item_id = keep_id WHERE item_id = drop_id;

  INSERT INTO merge_log_silicone_20261034 (tabella,row_id,old_item_id,new_item_id)
    SELECT 'inventory_supplier_codes', id, drop_id, keep_id FROM inventory_supplier_codes WHERE inventory_id = drop_id;
  UPDATE inventory_supplier_codes SET inventory_id = keep_id WHERE inventory_id = drop_id;

  FOR r IN SELECT * FROM job_inventory WHERE item_id = drop_id LOOP
    INSERT INTO merge_log_silicone_20261034 (tabella,row_id,old_item_id,new_item_id,dettaglio)
      VALUES ('job_inventory', r.id, drop_id, keep_id, to_jsonb(r));
    IF EXISTS (SELECT 1 FROM job_inventory WHERE job_id = r.job_id AND item_id = keep_id) THEN
      UPDATE job_inventory SET quantity = quantity + r.quantity, pieces = pieces + r.pieces, updated_at = now()
        WHERE job_id = r.job_id AND item_id = keep_id;
      DELETE FROM job_inventory WHERE id = r.id;
    ELSE
      UPDATE job_inventory SET item_id = keep_id WHERE id = r.id;
    END IF;
  END LOOP;

  INSERT INTO merge_log_silicone_20261034 (tabella,row_id,old_item_id,new_item_id,dettaglio)
    SELECT 'inventory', id, drop_id, keep_id, jsonb_build_object('quantity', quantity, 'pieces', pieces) FROM inventory WHERE id = drop_id;
  UPDATE inventory k SET quantity = k.quantity + d.quantity, pieces = k.pieces + d.pieces
    FROM inventory d WHERE k.id = keep_id AND d.id = drop_id;
  UPDATE inventory SET quantity = 0, pieces = 0, deleted_at = now(), deleted_by_name = 'Unione doppioni (Claude)' WHERE id = drop_id;
END $$;
