-- Attrezzatura: eliminato ATT-WUR-388 (Kit chiavi a bussola per Avvitatore), identico a ATT-WUR-389 e senza alcun riferimento
-- (eseguito in produzione, approvato). Ripristino: UPDATE public.inventory SET deleted_at = NULL, deleted_by_name = NULL WHERE code = 'ATT-WUR-388';
UPDATE public.inventory SET deleted_at = now(), deleted_by_name = 'Pulizia doppioni (Claude)'
WHERE code = 'ATT-WUR-388' AND deleted_at IS NULL;
