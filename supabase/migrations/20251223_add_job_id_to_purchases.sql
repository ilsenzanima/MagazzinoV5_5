-- Add job_id to purchases table
alter table public.purchases 
add column job_id uuid references public.jobs(id) on delete set null;

-- Add policy to allow updating job_id
create policy "Authenticated users can update purchases job_id."
  on purchases for update
  to authenticated
  using ( true );
