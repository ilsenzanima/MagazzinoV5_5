-- Add unique constraint to attendance table to allow upserts
alter table public.attendance
add constraint attendance_worker_date_key unique (worker_id, date);
