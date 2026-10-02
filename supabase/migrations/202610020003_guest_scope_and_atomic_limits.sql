-- Restrict visitor data access and serialize rate-limit checks.
begin;

-- The visitor/anon role may read published articles and public events only, not member profile or group records.
drop policy if exists "Public or signed-in profile read" on public.profiles;
create policy "Signed-in users read permitted profiles" on public.profiles for select to authenticated
using (visibility='public' or user_id=auth.uid() or public.is_staff());
drop policy if exists "Public groups or members read" on public.groups;
create policy "Signed-in users read permitted groups" on public.groups for select to authenticated
using ((is_public and moderation_state='active') or owner_id=auth.uid() or public.is_staff() or exists(select 1 from public.group_memberships gm where gm.group_id=id and gm.user_id=auth.uid() and gm.status='active'));

-- Safe public directory: the view exposes only professional display fields for active coaches.
-- It intentionally excludes email, registration numbers, workplace, private bio, and verification files.
create or replace view public.public_coaches with (security_barrier=true) as
select p.user_id,p.display_name,p.headline,p.profession,p.specialty,p.city,p.photo_url,
       cp.public_bio,cp.coaching_topics,cp.session_minutes,cp.booking_enabled
from public.profiles p
join public.coach_profiles cp on cp.user_id=p.user_id
join public.user_roles ur on ur.user_id=p.user_id and ur.role='coach'
where p.visibility='public';
grant select on public.public_coaches to anon,authenticated;

-- The live feed uses an invoker-security view: underlying RLS still decides which
-- posts, profiles, likes, and comments this authenticated user can see.
create or replace view public.community_feed with (security_invoker=true) as
select p.id,p.author_id,p.body,p.visibility,p.created_at,
       coalesce(pr.display_name,'عضو في المجتمع') as author_name,
       nullif(concat_ws(' · ',nullif(pr.headline,''),nullif(pr.profession,''),nullif(pr.city,'')),'') as author_title,
       (select r.role from public.user_roles r where r.user_id=p.author_id
        order by case r.role when 'manager' then 1 when 'moderator' then 2 when 'coach' then 3 when 'verified' then 4 else 5 end limit 1) as author_role,
       (select count(*)::integer from public.post_likes l where l.post_id=p.id) as likes_count,
       (select count(*)::integer from public.comments c where c.post_id=p.id and c.moderation_state='visible') as comments_count,
       exists(select 1 from public.post_likes l where l.post_id=p.id and l.user_id=auth.uid()) as liked_by_me
from public.posts p
left join public.profiles pr on pr.user_id=p.author_id
where p.moderation_state='visible';
grant select on public.community_feed to authenticated;

-- Serialize parallel writes by author so two simultaneous transactions cannot both evade daily limits.
create or replace function public.enforce_post_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not (public.has_role(new.author_id,'verified') or public.has_role(new.author_id,'coach') or public.has_role(new.author_id,'moderator') or public.has_role(new.author_id,'manager')) then
    raise exception 'النشر متاح للأعضاء الموثقين فقط';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('saytara-post:'||new.author_id::text,0));
  select count(*) into n from public.posts where author_id=new.author_id and created_at > now()-interval '24 hours';
  if n >= 5 then raise exception 'تم الوصول إلى الحد اليومي للمنشورات'; end if;
  return new;
end $$;
create or replace function public.enforce_message_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare n integer; lim integer := 15;
begin
  if public.has_role(new.sender_id,'verified') or public.has_role(new.sender_id,'coach') or public.has_role(new.sender_id,'moderator') or public.has_role(new.sender_id,'manager') then lim := 40; end if;
  perform pg_advisory_xact_lock(hashtextextended('saytara-message:'||new.sender_id::text,0));
  select count(*) into n from public.messages where sender_id=new.sender_id and created_at > now()-interval '24 hours';
  if n >= lim then raise exception 'تم الوصول إلى الحد اليومي للرسائل'; end if;
  return new;
end $$;

commit;
