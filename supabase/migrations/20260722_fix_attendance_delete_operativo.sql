-- Fix: la policy DELETE su attendance era rimasta limitata al solo ruolo 'admin'
-- (refuso introdotto in 20260122_fix_security_warnings.sql, il cui stesso commento
-- dichiarava che INSERT/UPDATE/DELETE dovevano essere permessi a admin+operativo,
-- come infatti gia' avviene per INSERT e UPDATE). Il frontend mostra il pulsante
-- "Elimina" anche agli operativi, causando un errore di permessi RLS al click.

DROP POLICY IF EXISTS "Attendance deletable by admin" ON attendance;

CREATE POLICY "Attendance deletable by operativo+"
    ON attendance FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
            AND profiles.role IN ('admin', 'operativo')
        )
    );
