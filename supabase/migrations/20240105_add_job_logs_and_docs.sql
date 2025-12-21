
-- Create Job Logs (Giornale di Cantiere)
create table if not exists public.job_logs (
  id uuid default uuid_generate_v4() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  user_id uuid references auth.users(id),
  date date not null default CURRENT_DATE,
  content text not null,
  weather_info jsonb, -- Stores weather snapshot {condition, temp_max, temp_min}
  tags text[], -- Array of tags e.g. ['sopralluogo', 'materiali']
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Job Documents (Documenti Cantiere)
create table if not exists public.job_documents (
  id uuid default uuid_generate_v4() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  name text not null,
  file_url text not null,
  file_type text, -- 'pdf', 'image', etc.
  category text, -- 'safety', 'project', 'contract', 'photo'
  uploaded_by uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.job_logs enable row level security;
alter table public.job_documents enable row level security;

-- Policies for Logs
create policy "Logs are viewable by authenticated users."
  on job_logs for select to authenticated using ( true );

create policy "Authenticated users can create logs."
  on job_logs for insert to authenticated with check ( auth.uid() = user_id );

-- Policies for Documents
create policy "Documents are viewable by authenticated users."
  on job_documents for select to authenticated using ( true );

create policy "Authenticated users can upload documents."
  on job_documents for insert to authenticated with check ( auth.uid() = uploaded_by );

-- Add indexes for performance
create index if not exists idx_job_logs_job_id on public.job_logs(job_id);
create index if not exists idx_job_logs_date on public.job_logs(date);
create index if not exists idx_job_documents_job_id on public.job_documents(job_id);
