-- La funzione «Rettifica ore» non viene più usata: l'unica rettifica esistente (-8 h il 15/05/2026 sulla commessa
-- 7af006a1…, operaio 7ca66f4c…) azzerava la presenza di 8 h dello stesso giorno. Si elimina la presenza e la rettifica:
-- il risultato per ore e costi è identico. La tabella attendance_corrections resta (vuota) perché altre pagine la leggono.
--
-- Per annullare:
--   INSERT INTO attendance (id, worker_id, job_id, date, status, hours, notes)
--     VALUES ('7ac7df28-e880-4780-a59a-e342cf105be3','7ca66f4c-0620-478d-8264-9589b7b5f0f6','7af006a1-adc5-4781-a83f-f495a0802286','2026-05-15','presence',8,'');
--   INSERT INTO attendance_corrections (id, worker_id, job_id, date, hours_delta)
--     VALUES ('58ff2a11-ffcf-4aac-aa12-48240904b271','7ca66f4c-0620-478d-8264-9589b7b5f0f6','7af006a1-adc5-4781-a83f-f495a0802286','2026-05-15',-8);

DELETE FROM attendance WHERE id = '7ac7df28-e880-4780-a59a-e342cf105be3' AND hours = 8;
DELETE FROM attendance_corrections WHERE id = '58ff2a11-ffcf-4aac-aa12-48240904b271';
