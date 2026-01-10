-- Diagnostic SQL for attendance issues
-- Run on Supabase SQL Editor

-- 1. Check orphaned attendance records (job_id pointing to non-existent jobs)
SELECT 
    a.id,
    a.worker_id,
    a.job_id,
    a.date,
    a.status,
    a.hours,
    w.first_name || ' ' || w.last_name as worker_name
FROM attendance a
LEFT JOIN workers w ON a.worker_id = w.id
WHERE a.job_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.id = a.job_id)
ORDER BY a.date DESC;

-- 2. Count attendance records by month
SELECT 
    to_char(date, 'YYYY-MM') as month,
    count(*) as record_count
FROM attendance
GROUP BY to_char(date, 'YYYY-MM')
ORDER BY month DESC;

-- 3. Check November 2025 specifically
SELECT 
    a.*,
    w.first_name || ' ' || w.last_name as worker_name,
    j.code as job_code
FROM attendance a
LEFT JOIN workers w ON a.worker_id = w.id
LEFT JOIN jobs j ON a.job_id = j.id
WHERE a.date >= '2025-11-01' AND a.date <= '2025-11-30'
ORDER BY a.date, w.last_name;

-- 4. Find records with invalid course_id references
SELECT 
    a.id,
    a.course_id,
    a.date,
    a.status
FROM attendance a
WHERE a.course_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM worker_courses wc WHERE wc.id = a.course_id);
