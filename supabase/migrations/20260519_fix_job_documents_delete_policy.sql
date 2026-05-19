-- Add missing DELETE policy for job_documents
-- Without this policy, RLS silently blocks deletions (no error, but record stays in DB)
CREATE POLICY "Authenticated users can delete documents"
  ON public.job_documents FOR DELETE TO authenticated
  USING ( true );
