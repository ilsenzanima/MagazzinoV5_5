-- Update check constraint for status to include 'injury' and 'transfer'
alter table public.attendance
drop constraint if exists attendance_status_check;

alter table public.attendance
add constraint attendance_status_check 
check (status in ('presence', 'absence', 'sick', 'holiday', 'permit', 'injury', 'transfer'));
