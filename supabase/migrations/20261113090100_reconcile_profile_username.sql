begin;

-- Production already has this optional public handle, but the original
-- repository migration chain did not recreate it. Keep clean local builds
-- and CRM exports aligned with the live schema.
alter table public.profiles
  add column if not exists username text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_username_format_check'
  ) then
    alter table public.profiles
      add constraint profiles_username_format_check
      check (username is null or username ~ '^[a-z0-9_]{3,24}$');
  end if;
end $$;

create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username))
  where username is not null;

commit;
