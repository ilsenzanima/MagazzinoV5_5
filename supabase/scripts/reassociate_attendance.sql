-- Script per riassociare le presenze orfane alle nuove commesse
-- Eseguire su Supabase SQL Editor

-- =====================================================
-- STEP 1: Verifica - Mostra i record orfani per ogni operaio
-- =====================================================

-- Marco Ponton - record senza job_id
SELECT a.id, a.date, a.hours, a.status, 'Marco Ponton' as operaio
FROM attendance a
JOIN workers w ON a.worker_id = w.id
WHERE a.job_id IS NULL 
  AND w.first_name ILIKE 'Marco' AND w.last_name ILIKE 'Ponton'
ORDER BY a.date;

-- Stefano Rusin - record senza job_id  
SELECT a.id, a.date, a.hours, a.status, 'Stefano Rusin' as operaio
FROM attendance a
JOIN workers w ON a.worker_id = w.id
WHERE a.job_id IS NULL 
  AND w.first_name ILIKE 'Stefano' AND w.last_name ILIKE 'Rusin'
ORDER BY a.date;

-- Alex D'Agostino - record senza job_id
SELECT a.id, a.date, a.hours, a.status, 'Alex D''Agostino' as operaio
FROM attendance a
JOIN workers w ON a.worker_id = w.id
WHERE a.job_id IS NULL 
  AND w.first_name ILIKE 'Alex' AND w.last_name ILIKE 'D''Agostino'
ORDER BY a.date;

-- =====================================================
-- STEP 2: Verifica - Mostra gli ID delle nuove commesse
-- =====================================================

SELECT id, code, name, description FROM jobs 
WHERE code IN ('2026-01-GRI', '2026-01-CXX', '2026-01-CHI');

-- =====================================================
-- STEP 3: AGGIORNAMENTO - Esegui SOLO dopo aver verificato i dati sopra
-- =====================================================

-- ATTENZIONE: Questi update assegneranno TUTTI i record orfani 
-- di ogni operaio alla rispettiva commessa.
-- Se un operaio ha lavorato su più cantieri, dovrai gestirlo manualmente.

-- Marco Ponton -> 2026-01-GRI (Casa di riposo Possagno)
UPDATE attendance
SET job_id = (SELECT id FROM jobs WHERE code = '2026-01-GRI' LIMIT 1)
WHERE job_id IS NULL
  AND worker_id = (SELECT id FROM workers WHERE first_name ILIKE 'Marco' AND last_name ILIKE 'Ponton' LIMIT 1);

-- Stefano Rusin -> 2026-01-CXX (CX-Place)
UPDATE attendance
SET job_id = (SELECT id FROM jobs WHERE code = '2026-01-CXX' LIMIT 1)
WHERE job_id IS NULL
  AND worker_id = (SELECT id FROM workers WHERE first_name ILIKE 'Stefano' AND last_name ILIKE 'Rusin' LIMIT 1);

-- Alex D'Agostino -> 2026-01-CHI (A.S.P.)
UPDATE attendance
SET job_id = (SELECT id FROM jobs WHERE code = '2026-01-CHI' LIMIT 1)
WHERE job_id IS NULL
  AND worker_id = (SELECT id FROM workers WHERE first_name ILIKE 'Alex' AND last_name ILIKE 'D''Agostino' LIMIT 1);

-- =====================================================
-- STEP 4: Verifica finale - Controlla che non ci siano più record orfani
-- =====================================================

SELECT 
    w.first_name || ' ' || w.last_name as operaio,
    COUNT(*) as record_orfani
FROM attendance a
JOIN workers w ON a.worker_id = w.id
WHERE a.job_id IS NULL
GROUP BY w.first_name, w.last_name
ORDER BY record_orfani DESC;
