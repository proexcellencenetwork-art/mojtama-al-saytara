-- مجتمع السيطرة — prevent client-supplied timestamps from bypassing rolling write limits.
-- Preserve the per-user transaction advisory lock introduced in migration 003.
begin;

create or replace function public.enforce_post_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
  v_now timestamptz;
begin
  if not (public.has_role(new.author_id,'verified') or public.has_role(new.author_id,'coach') or public.has_role(new.author_id,'moderator') or public.has_role(new.author_id,'manager')) then
    raise exception 'النشر متاح للأعضاء الموثقين فقط';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('saytara-post:'||new.author_id::text,0));
  v_now := clock_timestamp();
  new.created_at := v_now;
  select count(*) into n from public.posts
  where author_id=new.author_id and created_at > v_now-interval '24 hours';
  if n >= 5 then raise exception 'تم الوصول إلى الحد اليومي للمنشورات'; end if;
  return new;
end $$;

create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
  lim integer := 15;
  v_now timestamptz;
begin
  if public.has_role(new.sender_id,'verified') or public.has_role(new.sender_id,'coach') or public.has_role(new.sender_id,'moderator') or public.has_role(new.sender_id,'manager') then
    lim := 40;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('saytara-message:'||new.sender_id::text,0));
  v_now := clock_timestamp();
  new.created_at := v_now;
  select count(*) into n from public.messages
  where sender_id=new.sender_id and created_at > v_now-interval '24 hours';
  if n >= lim then raise exception 'تم الوصول إلى الحد اليومي للرسائل'; end if;
  return new;
end $$;

commit;
