begin;

-- Coaches may publish scheduled workshop entries and audience-scoped HTTPS links.
-- They do not gain owner/manager powers to create or control 100ms rooms.
alter table public.learning_workshops
  add column if not exists resource_url text
  check (resource_url is null or (char_length(resource_url) <= 2000 and resource_url ~ '^https://[^[:space:]]+$'));

create or replace function public.can_create_learning_content()
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.is_account_approved(), false)
    and (
      public.is_platform_owner()
      or public.has_role(auth.uid(), 'manager'::public.app_role)
      or public.has_role(auth.uid(), 'coach'::public.app_role)
    );
$$;
revoke all on function public.can_create_learning_content() from public, anon;
grant execute on function public.can_create_learning_content() to authenticated, service_role;

-- Let a coach view the workshop they authored even when the audience list excludes coaches.
-- Everyone else remains subject to approved-account and audience-role checks.
create or replace function public.can_access_learning_workshop(p_workshop_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is null or not coalesce(public.is_account_approved(), false) then false
    when public.can_manage_learning() then exists (
      select 1 from public.learning_workshops w where w.id = p_workshop_id
    )
    else exists (
      select 1
      from public.learning_workshops w
      where w.id = p_workshop_id
        and (
          w.created_by = auth.uid()
          or (
            w.status in ('scheduled'::public.learning_workshop_state,'live'::public.learning_workshop_state,'ended'::public.learning_workshop_state,'recorded'::public.learning_workshop_state)
            and exists (
              select 1 from unnest(w.audience_roles) as audience(role)
              where public.has_role(auth.uid(), audience.role)
            )
          )
        )
    )
  end;
$$;
revoke all on function public.can_access_learning_workshop(uuid) from public, anon;
grant execute on function public.can_access_learning_workshop(uuid) to authenticated, service_role;

-- New overload includes an optional-at-the-UI-level resource link. The 7-argument
-- legacy RPC remains manager/owner-only so old clients keep working safely.
create or replace function public.create_learning_workshop(
  p_title text,
  p_description text,
  p_instructor_name text,
  p_scheduled_at timestamptz,
  p_duration_minutes integer,
  p_cover_url text,
  p_audience_roles public.app_role[],
  p_resource_url text
) returns public.learning_workshops
language plpgsql security definer set search_path = '' as $$
declare
  result public.learning_workshops;
  owner_or_manager boolean;
begin
  if auth.uid() is null or not public.can_create_learning_content() then
    raise exception 'Approved coach, manager, or owner access required';
  end if;

  owner_or_manager := public.is_platform_owner()
    or public.has_role(auth.uid(), 'manager'::public.app_role);

  if not owner_or_manager
    and p_audience_roles && array['moderator'::public.app_role,'manager'::public.app_role] then
    raise exception 'Coaches cannot target staff-only audiences';
  end if;

  if p_title is null or char_length(btrim(p_title)) not between 3 and 140 then raise exception 'Workshop title must be 3-140 characters'; end if;
  if p_description is not null and char_length(p_description) > 6000 then raise exception 'Workshop description is too long'; end if;
  if p_instructor_name is null or char_length(btrim(p_instructor_name)) not between 2 and 120 then raise exception 'Instructor name must be 2-120 characters'; end if;
  if p_scheduled_at is null or p_duration_minutes not between 15 and 360 then raise exception 'Workshop schedule or duration is invalid'; end if;
  if coalesce(cardinality(p_audience_roles),0) not between 1 and 6 then raise exception 'Select at least one approved audience role'; end if;
  if p_cover_url is not null and (char_length(p_cover_url) > 1000 or p_cover_url !~ '^https://') then raise exception 'Cover image must use HTTPS'; end if;
  if p_resource_url is not null and (char_length(p_resource_url) > 2000 or p_resource_url !~ '^https://[^[:space:]]+$') then raise exception 'Workshop resource link must use HTTPS'; end if;

  insert into public.learning_workshops(
    title, description, instructor_name, scheduled_at, duration_minutes,
    cover_url, audience_roles, resource_url, created_by, updated_by
  )
  values(
    btrim(p_title), coalesce(p_description,''), btrim(p_instructor_name),
    p_scheduled_at, p_duration_minutes, nullif(btrim(p_cover_url),''),
    p_audience_roles, nullif(btrim(p_resource_url),''), auth.uid(), auth.uid()
  )
  returning * into result;
  return result;
end;
$$;
revoke all on function public.create_learning_workshop(text,text,text,timestamptz,integer,text,public.app_role[],text) from public, anon;
grant execute on function public.create_learning_workshop(text,text,text,timestamptz,integer,text,public.app_role[],text) to authenticated;

-- Owner-only account activity view: provides last sign-in timestamp without exposing auth.users to clients.
create or replace function public.list_platform_accounts_activity()
returns table(
  user_id uuid,
  email text,
  display_name text,
  account_status text,
  email_confirmed boolean,
  is_platform_owner boolean,
  roles public.app_role[],
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_platform_owner() then
    raise exception 'Owner access required';
  end if;
  return query
    select u.id, u.email::text, p.display_name, p.account_status,
      (u.email_confirmed_at is not null),
      exists(select 1 from public.platform_owner po where po.user_id = u.id),
      coalesce(array_agg(r.role order by r.role) filter (where r.role is not null), array[]::public.app_role[]),
      u.created_at, u.last_sign_in_at
    from auth.users u
    join public.profiles p on p.user_id = u.id
    left join public.user_roles r on r.user_id = u.id
    where u.deleted_at is null
    group by u.id, u.email, p.display_name, p.account_status, u.email_confirmed_at, u.created_at, u.last_sign_in_at
    order by u.created_at desc
    limit 200;
end;
$$;
revoke all on function public.list_platform_accounts_activity() from public, anon;
grant execute on function public.list_platform_accounts_activity() to authenticated;

commit;
