-- مجتمع السيطرة — break the groups/group_memberships RLS recursion without exposing arbitrary-user lookups.
begin;

create or replace function public.is_group_owner(p_group_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.groups g
    where g.id=p_group_id and g.owner_id=auth.uid()
  );
$$;
revoke all on function public.is_group_owner(uuid) from public,anon;
grant execute on function public.is_group_owner(uuid) to anon,authenticated;

create or replace function public.is_active_group_member(p_group_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.group_memberships gm
    where gm.group_id=p_group_id and gm.user_id=auth.uid() and gm.status='active'
  );
$$;
revoke all on function public.is_active_group_member(uuid) from public,anon;
grant execute on function public.is_active_group_member(uuid) to anon,authenticated;

create or replace function public.is_public_group(p_group_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.groups g
    where g.id=p_group_id and g.is_public=true
  );
$$;
revoke all on function public.is_public_group(uuid) from public,anon;
grant execute on function public.is_public_group(uuid) to authenticated;

-- The former SELECT policies queried each other and could recurse when members listed their own memberships.
drop policy if exists "Public groups or members read" on public.groups;
create policy "Public groups or members read" on public.groups for select to anon,authenticated
using (
  (is_public and moderation_state='active')
  or owner_id=auth.uid()
  or public.is_staff()
  or public.is_active_group_member(id)
);

drop policy if exists "Members read own memberships" on public.group_memberships;
create policy "Members read own memberships" on public.group_memberships for select to authenticated
using (user_id=auth.uid() or public.is_group_owner(group_id) or public.is_staff());

drop policy if exists "Members request or join" on public.group_memberships;
create policy "Members request or join" on public.group_memberships for insert to authenticated
with check (
  user_id=auth.uid() and
  (status='pending' or (status='active' and public.is_public_group(group_id)))
);

drop policy if exists "Member or group owner updates membership" on public.group_memberships;
create policy "Member or group owner updates membership" on public.group_memberships for update to authenticated
using (user_id=auth.uid() or public.is_group_owner(group_id) or public.is_staff())
with check (
  (user_id=auth.uid() and status in ('pending','removed'))
  or public.is_group_owner(group_id)
  or public.is_staff()
);

commit;
