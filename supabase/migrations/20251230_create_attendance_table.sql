-- Enable moddatetime extension if not exists
create extension if not exists moddatetime schema extensions;

-- Create Attendance table
create table if not exists public.attendance (
    id uuid default gen_random_uuid() primary key,
    worker_id uuid references public.workers(id) on delete cascade not null,
    job_id uuid references public.jobs(id) on delete set null, -- Can be null if status is 'sick' or 'holiday'
    date date not null,
    hours numeric(4,2) default 8.00,
    status text check (status in ('presence', 'absence', 'sick', 'holiday', 'permit')) default 'presence',
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

    -- Prevent duplicate entries for the same worker on the same date? 
    -- Maybe we want to allow splitting the day between two jobs?
    -- For now, let's NOT enforce unique(worker_id, date) to allow split shifts,
    -- but we might want a UI warning.
    constraint attendance_hours_check check (hours >= 0 and hours <= 24)
);

-- Enable RLS
alter table public.attendance enable row level security;

-- Policies
create policy "Attendance viewable by authenticated users"
    on public.attendance for select
    to authenticated
    using (true);

create policy "Attendance insertable by authenticated users"
    on public.attendance for insert
    to authenticated
    with check (true);

create policy "Attendance updatable by authenticated users"
    on public.attendance for update
    to authenticated
    using (true);

create policy "Attendance deletable by authenticated users"
    on public.attendance for delete
    to authenticated
    using (true);

-- Indexes
create index idx_attendance_worker_id on public.attendance(worker_id);
create index idx_attendance_job_id on public.attendance(job_id);
create index idx_attendance_date on public.attendance(date);
create index idx_attendance_worker_date on public.attendance(worker_id, date);

-- Updated_at trigger
create trigger handle_updated_at before update on public.attendance
    for each row execute procedure moddatetime (updated_at);
