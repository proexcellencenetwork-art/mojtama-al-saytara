begin;

create table if not exists public.community_feedback (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  area text not null check (area in ('groups','messages','tools','content','navigation','performance','other')),
  updated_at timestamptz not null default now()
);
alter table public.community_feedback enable row level security;
revoke all on public.community_feedback from public, anon;
grant select, insert, update, delete on public.community_feedback to authenticated;
drop policy if exists "Members manage own community feedback" on public.community_feedback;
create policy "Members manage own community feedback"
  on public.community_feedback for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Verified create groups" on public.groups;
create policy "Verified create groups"
  on public.groups for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (
      public.has_role(auth.uid(), 'verified'::public.app_role)
      or public.has_role(auth.uid(), 'coach'::public.app_role)
      or public.has_role(auth.uid(), 'manager'::public.app_role)
      or public.is_platform_owner()
    )
  );

create or replace function public.get_owner_community_satisfaction()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  response_count integer;
  average_rating numeric;
  distribution jsonb;
  area_summary jsonb;
begin
  if auth.uid() is null
    or not (public.is_platform_owner() or public.has_role(auth.uid(), 'manager'::public.app_role)) then
    raise exception 'Owner or manager access required';
  end if;

  select count(*)::integer, round(avg(rating)::numeric, 2)
    into response_count, average_rating
  from public.community_feedback;

  select coalesce(jsonb_object_agg(rating::text, total), '{}'::jsonb)
    into distribution
  from (
    select rating, count(*)::integer as total
    from public.community_feedback
    group by rating
  ) ratings;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'area', area,
        'responses', total,
        'average', round(mean_rating::numeric, 2)
      ) order by total desc, area
    ),
    '[]'::jsonb
  )
    into area_summary
  from (
    select area, count(*)::integer as total, avg(rating) as mean_rating
    from public.community_feedback
    group by area
  ) areas;

  return jsonb_build_object(
    'responses', response_count,
    'average', average_rating,
    'distribution', distribution,
    'areas', area_summary
  );
end;
$$;

revoke all on function public.get_owner_community_satisfaction() from public, anon;
grant execute on function public.get_owner_community_satisfaction() to authenticated;

comment on table public.community_feedback is
  'One optional, editable satisfaction rating per member. Owner/manager reporting is aggregated and contains no free-text responses.';

commit;
