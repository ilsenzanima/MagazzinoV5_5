-- RICOSTRUZIONE STORICA: questa migration risulta gia' applicata al progetto
-- Supabase "Magazzino" (versione 20260713075841, nome "operativo_delete_permissions")
-- ma non era mai stata committata in questo repository, causando un disallineamento
-- tra lo schema live e supabase/migrations. Il contenuto sotto e' copiato 1:1 da
-- supabase_migrations.schema_migrations sul progetto live, per ripristinare lo
-- storico corretto. Non ha effetto se rieseguita (DROP POLICY IF EXISTS + CREATE).
--
-- Allinea alle policy DELETE gia' in vigore su tabelle analoghe (job_inventory, job_tasks,
-- inventory_supplier_codes, ecc.): il ruolo Operativo poteva vedere ed eliminare via UI questi
-- record, ma la policy RLS restava "solo Admin", generando errori di permesso solo per gli
-- utenti Operativo reali (non riproducibili con il Simulatore di Ruolo, che non cambia la sessione).

-- delivery_notes / delivery_note_items (eliminazione movimento/DDT)
DROP POLICY IF EXISTS "Delivery notes delete by Admin only" ON public.delivery_notes;
CREATE POLICY "Delivery notes delete by Admin/Operativo" ON public.delivery_notes
    FOR DELETE TO authenticated USING ((select public.get_my_role()) IN ('admin', 'operativo'));

DROP POLICY IF EXISTS "Delivery note items delete by Admin only" ON public.delivery_note_items;
CREATE POLICY "Delivery note items delete by Admin/Operativo" ON public.delivery_note_items
    FOR DELETE TO authenticated USING ((select public.get_my_role()) IN ('admin', 'operativo'));

-- purchase_items (eliminazione riga articolo in un acquisto)
DROP POLICY IF EXISTS "Purchase items delete by Admin only" ON public.purchase_items;
CREATE POLICY "Purchase items delete by Admin/Operativo" ON public.purchase_items
    FOR DELETE TO authenticated USING ((select public.get_my_role()) IN ('admin', 'operativo'));

-- attendance (eliminazione timbratura)
DROP POLICY IF EXISTS "Attendance deletable by admin" ON public.attendance;
CREATE POLICY "Attendance deletable by admin/operativo" ON public.attendance
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (select auth.uid())
              AND profiles.role IN ('admin', 'operativo')
        )
    );

-- worker_courses (eliminazione corso operaio)
DROP POLICY IF EXISTS "Worker courses deletable by admin" ON public.worker_courses;
CREATE POLICY "Worker courses deletable by admin/operativo" ON public.worker_courses
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (select auth.uid())
              AND profiles.role IN ('admin', 'operativo')
        )
    );

-- worker_medical_exams (eliminazione visita medica operaio)
DROP POLICY IF EXISTS "Worker medical exams deletable by admin" ON public.worker_medical_exams;
CREATE POLICY "Worker medical exams deletable by admin/operativo" ON public.worker_medical_exams
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = (select auth.uid())
              AND profiles.role IN ('admin', 'operativo')
        )
    );
