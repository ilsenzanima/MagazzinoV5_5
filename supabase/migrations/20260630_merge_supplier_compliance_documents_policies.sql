-- Unisce le policy permissive duplicate per SELECT su supplier_compliance_documents
-- (prima erano valutate piu' policy per lo stesso ruolo/azione ad ogni query)
DROP POLICY IF EXISTS "Compliance docs readable by Admin/Operativo" ON public.supplier_compliance_documents;
CREATE POLICY "Compliance docs readable by Admin/Operativo" ON public.supplier_compliance_documents
    FOR SELECT TO authenticated
    USING (
        ((get_my_role() = ANY (ARRAY['admin'::text, 'operativo'::text])) AND (deleted_at IS NULL))
        OR ((get_my_role() = 'admin'::text) AND (deleted_at IS NOT NULL))
    );
