-- Create guest_sites table
CREATE TABLE IF NOT EXISTS public.guest_sites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    address text NOT NULL,
    passcode text NOT NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

-- Create guest_site_jobs table
CREATE TABLE IF NOT EXISTS public.guest_site_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_site_id uuid NOT NULL REFERENCES public.guest_sites(id) ON DELETE CASCADE,
    job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    custom_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

-- Performance and soft-delete indexes
CREATE INDEX IF NOT EXISTS idx_guest_sites_deleted_at ON public.guest_sites(deleted_at);
CREATE INDEX IF NOT EXISTS idx_guest_site_jobs_guest_site_id ON public.guest_site_jobs(guest_site_id);
CREATE INDEX IF NOT EXISTS idx_guest_site_jobs_job_id ON public.guest_site_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_guest_site_jobs_deleted_at ON public.guest_site_jobs(deleted_at);

-- Unique index to prevent duplicate active job associations
CREATE UNIQUE INDEX IF NOT EXISTS guest_site_jobs_unique_active_idx 
ON public.guest_site_jobs (guest_site_id, job_id) 
WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE public.guest_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_site_jobs ENABLE ROW LEVEL SECURITY;

-- Policies for guest_sites
CREATE POLICY "Authenticated users can read guest sites"
    ON public.guest_sites FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Admin and operativo can insert guest sites"
    ON public.guest_sites FOR INSERT TO authenticated
    WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));

CREATE POLICY "Admin and operativo can update guest sites"
    ON public.guest_sites FOR UPDATE TO authenticated
    USING (public.get_my_role() IN ('admin', 'operativo'))
    WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));

CREATE POLICY "Admin only can delete guest sites"
    ON public.guest_sites FOR DELETE TO authenticated
    USING (public.get_my_role() = 'admin');

-- Policies for guest_site_jobs
CREATE POLICY "Authenticated users can read guest site jobs"
    ON public.guest_site_jobs FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Admin and operativo can insert guest site jobs"
    ON public.guest_site_jobs FOR INSERT TO authenticated
    WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));

CREATE POLICY "Admin and operativo can update guest site jobs"
    ON public.guest_site_jobs FOR UPDATE TO authenticated
    USING (public.get_my_role() IN ('admin', 'operativo'))
    WITH CHECK (public.get_my_role() IN ('admin', 'operativo'));

CREATE POLICY "Admin only can delete guest site jobs"
    ON public.guest_site_jobs FOR DELETE TO authenticated
    USING (public.get_my_role() = 'admin');
