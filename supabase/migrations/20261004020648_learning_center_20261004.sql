begin;

-- Private workshop metadata, constrained to approved users and server-verified roles.
do $$ begin
  create type public.learning_workshop_state as enum ('scheduled','live','ended','recorded');
exception when duplicate_object then null; end $$;

create table if not exists public.learning_workshops (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 140),
  description text not null default '' check (char_length(description) <= 6000),
  instructor_name text not null check (char_length(btrim(instructor_name)) between 2 and 120),
  scheduled_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 15 and 360),
  cover_url text check (cover_url is null or (char_length(cover_url) <= 1000 and cover_url ~ '^https://')),
  audience_roles public.app_role[] not null default array['member'::public.app_role,'verified'::public.app_role,'coach'::public.app_role,'moderator'::public.app_role,'manager'::public.app_role],
  status public.learning_workshop_state not null default 'scheduled',
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_workshops_audience_not_empty check (cardinality(audience_roles) between 1 and 6)
);

create table if not exists public.learning_provider_rooms (
  workshop_id uuid primary key references public.learning_workshops(id) on delete cascade,
  provider text not null default '100ms' check (provider = '100ms'),
  provider_room_id text not null unique,
  provider_room_name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_recordings (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.learning_workshops(id) on delete cascade,
  provider text not null default '100ms' check (provider = '100ms'),
  provider_asset_id text not null unique,
  session_id text not null,
  duration_seconds integer check (duration_seconds is null or duration_seconds between 0 and 43200),
  status text not null check (status in ('completed','failed')),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.learning_provider_events (
  event_id text primary key,
  event_type text not null,
  provider_room_id text,
  session_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists learning_workshops_schedule_idx on public.learning_workshops(scheduled_at desc);
create index if not exists learning_workshops_status_idx on public.learning_workshops(status);
create index if not exists learning_recordings_workshop_idx on public.learning_recordings(workshop_id, recorded_at desc);

create or replace function public.can_manage_learning()
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.is_account_approved(), false)
    and (public.is_platform_owner() or public.has_role(auth.uid(), 'manager'::public.app_role));
$$;
revoke all on function public.can_manage_learning() from public, anon;
grant execute on function public.can_manage_learning() to authenticated, service_role;

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
        and w.status in ('scheduled'::public.learning_workshop_state,'live'::public.learning_workshop_state,'ended'::public.learning_workshop_state,'recorded'::public.learning_workshop_state)
        and exists (
          select 1 from unnest(w.audience_roles) as audience(role)
          where public.has_role(auth.uid(), audience.role)
        )
    )
  end;
$$;
revoke all on function public.can_access_learning_workshop(uuid) from public, anon;
grant execute on function public.can_access_learning_workshop(uuid) to authenticated, service_role;

alter table public.learning_workshops enable row level security;
alter table public.learning_provider_rooms enable row level security;
alter table public.learning_recordings enable row level security;
alter table public.learning_provider_events enable row level security;

revoke all on public.learning_workshops from anon, authenticated;
grant select on public.learning_workshops to authenticated;
drop policy if exists learning_workshops_authorized_read on public.learning_workshops;
create policy learning_workshops_authorized_read on public.learning_workshops
  for select to authenticated using (public.can_access_learning_workshop(id));

-- Provider room IDs, webhook events and asset IDs are server-only; clients receive only safe metadata/RPC results.
revoke all on public.learning_provider_rooms from public, anon, authenticated;
revoke all on public.learning_recordings from public, anon, authenticated;
revoke all on public.learning_provider_events from public, anon, authenticated;
grant all on public.learning_provider_rooms to service_role;
grant all on public.learning_recordings to service_role;
grant all on public.learning_provider_events to service_role;

drop trigger if exists learning_workshops_updated on public.learning_workshops;
create trigger learning_workshops_updated before update on public.learning_workshops
  for each row execute procedure public.set_updated_at();

create or replace function public.create_learning_workshop(
  p_title text,
  p_description text,
  p_instructor_name text,
  p_scheduled_at timestamptz,
  p_duration_minutes integer,
  p_cover_url text default null,
  p_audience_roles public.app_role[] default array['member'::public.app_role,'verified'::public.app_role,'coach'::public.app_role,'moderator'::public.app_role,'manager'::public.app_role]
) returns public.learning_workshops
language plpgsql security definer set search_path = '' as $$
declare result public.learning_workshops;
begin
  if auth.uid() is null or not public.can_manage_learning() then raise exception 'Owner or manager access required'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 3 and 140 then raise exception 'Workshop title must be 3-140 characters'; end if;
  if p_description is not null and char_length(p_description) > 6000 then raise exception 'Workshop description is too long'; end if;
  if p_instructor_name is null or char_length(btrim(p_instructor_name)) not between 2 and 120 then raise exception 'Instructor name must be 2-120 characters'; end if;
  if p_scheduled_at is null or p_duration_minutes not between 15 and 360 then raise exception 'Workshop schedule or duration is invalid'; end if;
  if coalesce(cardinality(p_audience_roles),0) not between 1 and 6 then raise exception 'Select at least one approved audience role'; end if;
  if p_cover_url is not null and (char_length(p_cover_url) > 1000 or p_cover_url !~ '^https://') then raise exception 'Cover image must use HTTPS'; end if;

  insert into public.learning_workshops(title,description,instructor_name,scheduled_at,duration_minutes,cover_url,audience_roles,created_by,updated_by)
  values(btrim(p_title),coalesce(p_description,''),btrim(p_instructor_name),p_scheduled_at,p_duration_minutes,nullif(btrim(p_cover_url),''),p_audience_roles,auth.uid(),auth.uid())
  returning * into result;
  return result;
end;
$$;
revoke all on function public.create_learning_workshop(text,text,text,timestamptz,integer,text,public.app_role[]) from public, anon;
grant execute on function public.create_learning_workshop(text,text,text,timestamptz,integer,text,public.app_role[]) to authenticated;

create or replace function public.set_learning_workshop_status(
  p_workshop_id uuid,
  p_next_status public.learning_workshop_state
) returns public.learning_workshops
language plpgsql security definer set search_path = '' as $$
declare current_row public.learning_workshops;
begin
  if auth.uid() is null or not public.can_manage_learning() then raise exception 'Owner or manager access required'; end if;
  select * into current_row from public.learning_workshops where id=p_workshop_id for update;
  if not found then raise exception 'Workshop not found'; end if;
  if not (
    (current_row.status='scheduled' and p_next_status='live')
    or (current_row.status='live' and p_next_status='ended')
  ) then raise exception 'Invalid workshop status transition'; end if;
  update public.learning_workshops set status=p_next_status,updated_by=auth.uid()
  where id=p_workshop_id returning * into current_row;
  return current_row;
end;
$$;
revoke all on function public.set_learning_workshop_status(uuid,public.learning_workshop_state) from public, anon;
grant execute on function public.set_learning_workshop_status(uuid,public.learning_workshop_state) to authenticated;

create or replace function public.list_learning_library()
returns table (
  recording_id uuid,
  workshop_id uuid,
  title text,
  description text,
  instructor_name text,
  scheduled_at timestamptz,
  duration_minutes integer,
  cover_url text,
  recording_duration_seconds integer,
  recorded_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select r.id,w.id,w.title,w.description,w.instructor_name,w.scheduled_at,w.duration_minutes,w.cover_url,r.duration_seconds,r.recorded_at
  from public.learning_recordings r
  join public.learning_workshops w on w.id=r.workshop_id
  where r.status='completed' and w.status='recorded' and public.can_access_learning_workshop(w.id)
  order by r.recorded_at desc
  limit 200;
$$;
revoke all on function public.list_learning_library() from public, anon;
grant execute on function public.list_learning_library() to authenticated;

commit;
