-- Migration: Fix FK constraint on delivery_note_items.purchase_item_id
-- Data: 2026-01-12
-- Descrizione: Cambia la FK per permettere ON DELETE SET NULL
-- Problema: Quando si cancella un purchase_item referenziato da delivery_note_items,
--           PostgreSQL blocca l'operazione perché la FK di default è RESTRICT.
-- Soluzione: Aggiungere ON DELETE SET NULL per permettere la cancellazione degli acquisti
--            anche se sono stati utilizzati in movimenti.

-- 1. Drop vecchio constraint (se esiste)
ALTER TABLE public.delivery_note_items 
DROP CONSTRAINT IF EXISTS delivery_note_items_purchase_item_id_fkey;

-- 2. Ricrea constraint con ON DELETE SET NULL
ALTER TABLE public.delivery_note_items 
ADD CONSTRAINT delivery_note_items_purchase_item_id_fkey 
FOREIGN KEY (purchase_item_id) REFERENCES public.purchase_items(id) ON DELETE SET NULL;

-- Nota: Quando un purchase_item viene cancellato, i delivery_note_items che lo referenziano
-- avranno purchase_item_id = NULL, mantenendo la tracciabilità storica (il movimento rimane,
-- perde solo il riferimento al lotto specifico).
