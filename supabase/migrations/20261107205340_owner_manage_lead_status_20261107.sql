create or replace function public.owner_update_lead_status(p_lead_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null or not public.is_platform_owner() then raise exception 'Owner access required'; end if;
  if p_status not in ('new','contacted','qualified','archived') then raise exception 'Invalid lead status'; end if;
  update public.onboarding_leads set status=p_status,updated_at=now() where id=p_lead_id;
  return found;
end;
$$;
revoke all on function public.owner_update_lead_status(uuid,text) from public;
grant execute on function public.owner_update_lead_status(uuid,text) to authenticated;
