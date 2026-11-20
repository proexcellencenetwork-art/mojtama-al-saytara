-- Owner-only aggregate insight for the member professional portfolio.
-- This returns counts only; it never exposes member IDs or portfolio text.
begin;

create or replace function public.get_owner_professional_portfolio_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not public.is_platform_owner() then
    raise exception 'Owner access required';
  end if;

  select jsonb_build_object(
    'total_items', count(*)::integer,
    'members_with_items', count(distinct user_id)::integer,
    'projects', count(*) filter (where item_type = 'project')::integer,
    'solved_problems', count(*) filter (where item_type = 'solved_problem')::integer,
    'skills', count(*) filter (where item_type = 'skill')::integer,
    'results', count(*) filter (where item_type = 'result')::integer,
    'public_items', count(*) filter (where visibility = 'public')::integer,
    'private_items', count(*) filter (where visibility = 'private')::integer
  )
  into result
  from public.professional_portfolio_items;

  return coalesce(result, '{}'::jsonb);
end;
$$;

revoke all on function public.get_owner_professional_portfolio_summary() from public, anon, service_role;
grant execute on function public.get_owner_professional_portfolio_summary() to authenticated;

comment on function public.get_owner_professional_portfolio_summary() is
  'Returns aggregate-only professional portfolio counts to the platform owner; never returns member identities or record content.';

commit;
