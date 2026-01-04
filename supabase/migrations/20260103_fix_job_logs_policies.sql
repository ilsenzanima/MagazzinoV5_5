-- Add missing DELETE and UPDATE policies for job_logs
-- Allow users to delete their own logs, or admin/operativo to delete any log

-- DROP existing policies if any
DROP POLICY IF EXISTS "Users can delete own logs" ON public.job_logs;
DROP POLICY IF EXISTS "Users can update own logs" ON public.job_logs;
DROP POLICY IF EXISTS "Admins can delete any log" ON public.job_logs;
DROP POLICY IF EXISTS "Admins can update any log" ON public.job_logs;

-- DELETE: Users can delete their own logs
CREATE POLICY "Users can delete own logs" 
  ON public.job_logs FOR DELETE TO authenticated 
  USING (auth.uid() = user_id);

-- DELETE: Admin/Operativo can delete any log
CREATE POLICY "Admins can delete any log" 
  ON public.job_logs FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'operativo')
    )
  );

-- UPDATE: Users can update their own logs
CREATE POLICY "Users can update own logs" 
  ON public.job_logs FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Admin/Operativo can update any log
CREATE POLICY "Admins can update any log" 
  ON public.job_logs FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'operativo')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'operativo')
    )
  );
