-- Function to allow admins to update user roles
create or replace function public.update_user_role(
  target_user_id uuid,
  new_role text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- Check if the executing user is an admin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'admin'
  ) then
    raise exception 'Access denied: Only admins can update roles.';
  end if;

  -- Update the target user's role
  update public.profiles
  set role = new_role, updated_at = now()
  where id = target_user_id;
end;
$$;
