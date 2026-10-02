-- مجتمع السيطرة — map verified Supabase Auth metadata into a safe default member profile.
-- Additive migration: keep migrations 001–006 immutable for projects that already applied them.
begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  profile_name text;
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

  profile_photo := coalesce(
    nullif(btrim(metadata->>'avatar_url'), ''),
    nullif(btrim(metadata->>'picture'), '')
  );
  if profile_photo is not null and (length(profile_photo) > 2048 or profile_photo !~ '^https://') then
    profile_photo := null;
  end if;

  insert into public.profiles(user_id, display_name, photo_url)
  values (new.id, profile_name, profile_photo)
  on conflict (user_id) do nothing;

  -- Auth metadata (including Google claims) is never trusted for authorization.
  -- All new accounts begin as ordinary members; staff grants roles separately.
  insert into public.user_roles(user_id, role)
  values (new.id, 'member')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

commit;
