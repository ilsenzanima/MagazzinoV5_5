-- Create leave_requests table
create table if not exists public.leave_requests (
    id uuid not null default gen_random_uuid(),
    worker_id uuid not null references public.workers(id) on delete cascade,
    date date not null,
    end_date date not null,
    hours numeric not null default 8,
    requester_id uuid references auth.users(id),
    status text not null default 'approved',
    created_at timestamp with time zone not null default now(),
    constraint leave_requests_pkey primary key (id)
);

-- Enable RLS
alter table public.leave_requests enable row level security;

-- Policy: Allow read access to authenticated users
create policy "Allow read access to all authenticated users"
    on public.leave_requests
    for select
    to authenticated
    using (true);

-- Policy: Allow insert access to authenticated users
create policy "Allow insert access to all authenticated users"
    on public.leave_requests
    for insert
    to authenticated
    with check (true);

-- Policy: Allow update/delete access to authenticated users (or maybe restrict to requester/admin later)
-- For now, consistent with "no limitations"
create policy "Allow update access to all authenticated users"
    on public.leave_requests
    for update
    to authenticated
    using (true);

create policy "Allow delete access to all authenticated users"
    on public.leave_requests
    for delete
    to authenticated
    using (true);
