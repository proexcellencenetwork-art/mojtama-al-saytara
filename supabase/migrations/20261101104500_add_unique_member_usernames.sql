-- Keep the production migration history aligned with the already-applied username schema.
alter table public.profiles
  add column if not exists username text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_username_format_check'
  ) then
    alter table public.profiles
      add constraint profiles_username_format_check
      check (username is null or username ~ '^[a-z0-9_]{3,24}$');
  end if;
end
$$;

create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username))
  where username is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  profile_name text;
  profile_username text;
  profile_photo text;
begin
  profile_name := coalesce(
    nullif(btrim(metadata->>'display_name'), ''),
    nullif(btrim(metadata->>'full_name'), ''),
    nullif(btrim(metadata->>'name'), ''),
    nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
    'عضو جديد'
  );
  profile_name := left(profile_name, 100);
  profile_username := nullif(lower(btrim(metadata->>'username')), '');
  if profile_username is not null and profile_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'username must be 3-24 lowercase letters, numbers or underscores';
  end if;
  profile_photo := coalesce(nullif(btrim(metadata->>'avatar_url'), ''), nullif(btrim(metadata->>'picture'), ''));
  if profile_photo is not null and (length(profile_photo) > 2048 or profile_photo !~ '^https://') then
    profile_photo := null;
  end if;
  insert into public.profiles(user_id, display_name, username, photo_url, account_status)
  values (new.id, profile_name, profile_username, profile_photo, 'pending')
  on conflict (user_id) do nothing;
  insert into public.user_roles(user_id, role)
  values (new.id, 'member')
  on conflict (user_id, role) do nothing;
  return new;
end;
$function$;
