-- Script per eliminare presenze orfane (senza cantiere)
-- Eseguire su Supabase SQL Editor

-- =====================================================
-- STEP 1: Verifica - Conta quanti record verranno eliminati
-- =====================================================

SELECT 
    w.first_name || ' ' || w.last_name as operaio,
    a.date,
    a.hours,
    a.status
FROM attendance a
JOIN workers w ON a.worker_id = w.id
WHERE a.job_id IS NULL
ORDER BY a.date DESC, w.last_name;

-- Conteggio totale
SELECT COUNT(*) as record_da_eliminare 
FROM attendance 
WHERE job_id IS NULL;

-- =====================================================
-- STEP 2: ELIMINAZIONE - Esegui SOLO dopo aver verificato sopra
-- =====================================================

DELETE FROM attendance WHERE job_id IS NULL;

-- =====================================================
-- STEP 3: Verifica finale
-- =====================================================

SELECT COUNT(*) as record_rimasti_orfani 
FROM attendance 
WHERE job_id IS NULL;
-- Dovrebbe essere 0
