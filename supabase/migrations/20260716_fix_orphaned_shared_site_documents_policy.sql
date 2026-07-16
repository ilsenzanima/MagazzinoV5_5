-- Drop the orphaned permissive catch-all policy on shared_site_documents.
-- The 20260709_fix_document_rls_policies.sql migration intended to remove it
-- but referenced the wrong policy name ("authenticated all site_docs" instead
-- of the real name "authenticated all shared_site_documents"), so the DROP
-- POLICY IF EXISTS silently matched nothing and the old policy survived,
-- letting any authenticated user (regardless of role) bypass the intended
-- admin/operativo restriction on insert/update/delete.
DROP POLICY IF EXISTS "authenticated all shared_site_documents" ON public.shared_site_documents;

-- Clean up leftover duplicate policies on job_documents, superseded by
-- job_documents_select / job_documents_delete (created in the same 20260709
-- migration) with equal or broader effect. Purely redundant, flagged by the
-- Supabase performance advisor as multiple_permissive_policies.
DROP POLICY IF EXISTS "Documents are viewable by authenticated users." ON public.job_documents;
DROP POLICY IF EXISTS "Admin can delete documents" ON public.job_documents;
