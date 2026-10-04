-- مجتمع السيطرة — ملف إعداد موحّد لمشروع Supabase جديد.
-- انسخ الملف كاملاً إلى SQL Editor وشغّله مرة واحدة فقط.
-- يضم migrations 001–017 بترتيبها داخل معاملة واحدة؛ لا يتضمن seed.sql.
-- يجب تطبيقه على مشروع Supabase فارغ، لا فوق مخطط سابق.

BEGIN;

-- ===== Source: supabase/migrations/202610020001_initial_schema.sql =====
-- مجتمع السيطرة — Supabase / PostgreSQL initial schema
-- Apply via Supabase SQL Editor or `supabase db push`. Never put service_role in browser code.
create extension if not exists pgcrypto;

do $$ begin create type public.app_role as enum ('member','verified','coach','moderator','manager'); exception when duplicate_object then null; end $$;
do $$ begin create type public.review_state as enum ('pending','approved','rejected','more_information'); exception when duplicate_object then null; end $$;
do $$ begin create type public.connection_state as enum ('pending','accepted','declined','blocked'); exception when duplicate_object then null; end $$;
do $$ begin create type public.group_state as enum ('active','pending','removed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.report_state as enum ('open','reviewing','resolved','dismissed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.report_target as enum ('post','comment','message','profile','group','event'); exception when duplicate_object then null; end $$;
do $$ begin create type public.membership_state as enum ('inactive','active','cancelled','expired'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'عضو جديد' check (char_length(display_name) between 1 and 100),
  headline text not null default '' check (char_length(headline) <= 160),
  profession text not null default '' check (char_length(profession) <= 100),
  specialty text not null default '' check (char_length(specialty) <= 120),
  workplace text not null default '' check (char_length(workplace) <= 160),
  bio text not null default '' check (char_length(bio) <= 1200),
  photo_url text,
  experience_years smallint check (experience_years between 0 and 80),
  interests text[] not null default '{}',
  goals text[] not null default '{}',
  city text not null default '' check (char_length(city) <= 100),
  visibility text not null default 'public' check (visibility in ('public','connections','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'member',
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 160),
  profession text not null check (char_length(profession) between 2 and 120),
  specialty text not null default '' check (char_length(specialty) <= 160),
  workplace text not null default '' check (char_length(workplace) <= 200),
  professional_registration_no text not null check (char_length(professional_registration_no) between 2 and 100),
  document_path text not null,
  status public.review_state not null default 'pending',
  decision_reason text check (char_length(decision_reason) <= 1200),
  reviewer_id uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists verification_requests_queue_idx on public.verification_requests(status, requested_at desc);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  media_urls text[] not null default '{}',
  link_url text check (link_url is null or link_url ~ '^https?://'),
  visibility text not null default 'members' check (visibility in ('members','connections','public')),
  moderation_state text not null default 'visible' check (moderation_state in ('visible','hidden','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_feed_idx on public.posts(created_at desc) where moderation_state = 'visible';

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  moderation_state text not null default 'visible' check (moderation_state in ('visible','hidden','removed')),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments(post_id, created_at);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id,user_id)
);
create table if not exists public.saved_posts (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id,user_id)
);

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status public.connection_state not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint connections_distinct_people check (requester_id <> recipient_id),
  constraint connections_pair_unique unique (requester_id,recipient_id)
);
create index if not exists connections_recipient_idx on public.connections(recipient_id,status);

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id,blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  member_a uuid not null references auth.users(id) on delete cascade,
  member_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint conversations_distinct_members check (member_a <> member_b),
  constraint conversations_pair_unique unique (member_a,member_b)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  read_at timestamptz,
  moderation_state text not null default 'visible' check (moderation_state in ('visible','hidden','removed')),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index if not exists messages_conversation_idx on public.messages(conversation_id,created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('like','comment','connection','message','verification','group','event','system')),
  entity_type text,
  entity_id uuid,
  body text not null default '' check (char_length(body) <= 500),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(recipient_id,is_read,created_at desc);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '' check (char_length(description) <= 1500),
  topic text not null default '' check (char_length(topic) <= 100),
  is_public boolean not null default true,
  owner_id uuid not null references auth.users(id) on delete cascade,
  moderation_state text not null default 'active' check (moderation_state in ('active','hidden','removed')),
  created_at timestamptz not null default now()
);
create table if not exists public.group_memberships (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.group_state not null default 'pending',
  joined_at timestamptz not null default now(),
  primary key (group_id,user_id)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 180),
  description text not null default '' check (char_length(description) <= 3000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text not null default 'افتراضي' check (char_length(location) <= 200),
  is_private boolean not null default false,
  moderation_state text not null default 'visible' check (moderation_state in ('visible','hidden','removed')),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists events_start_idx on public.events(starts_at);
create table if not exists public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'going' check (status in ('going','waitlist','cancelled')),
  created_at timestamptz not null default now(),
  primary key (event_id,user_id)
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 220),
  slug text unique,
  excerpt text not null default '' check (char_length(excerpt) <= 500),
  body text not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists articles_public_idx on public.articles(published_at desc) where status = 'published';

create table if not exists public.coach_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_bio text not null default '' check (char_length(public_bio) <= 1500),
  coaching_topics text[] not null default '{}',
  session_minutes smallint[] not null default '{30,60}',
  booking_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.coach_availability (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_available boolean not null default true,
  check (ends_at > starts_at)
);
create table if not exists public.coaching_bookings (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  availability_id uuid references public.coach_availability(id) on delete set null,
  starts_at timestamptz not null,
  minutes smallint not null check (minutes in (30,45,60,90)),
  member_note text not null default '' check (char_length(member_note) <= 1000),
  status text not null default 'requested' check (status in ('requested','accepted','declined','cancelled','completed')),
  created_at timestamptz not null default now(),
  check (coach_id <> member_id)
);

create table if not exists public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  benefits text[] not null default '{}',
  price_sar numeric(10,2),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.membership_plans(id),
  status public.membership_state not null default 'inactive',
  provider text check (provider is null or provider in ('moyasar','tap','manual')),
  provider_ref text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text not null check (reason in ('patient_information','harassment','spam','privacy','misinformation','other')),
  details text not null default '' check (char_length(details) <= 1500),
  status public.report_state not null default 'open',
  moderator_id uuid references auth.users(id) on delete set null,
  moderator_note text check (char_length(moderator_note) <= 1500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists reports_queue_idx on public.reports(status,created_at desc);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references auth.users(id),
  subject_user_id uuid references auth.users(id) on delete set null,
  target_type text not null,
  target_id uuid,
  action text not null check (action in ('hide','remove','restore','suspend','unsuspend','verification_decision')),
  reason text not null default '' check (char_length(reason) <= 1500),
  created_at timestamptz not null default now()
);
create table if not exists public.verification_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null default 'verification-private',
  object_path text not null,
  queued_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create or replace function public.has_role(p_user uuid, p_role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$ select exists(select 1 from public.user_roles r where r.user_id=p_user and r.role=p_role); $$;
create or replace function public.is_staff(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$ select public.has_role(p_user,'moderator') or public.has_role(p_user,'manager'); $$;
create or replace function public.can_message(p_sender uuid, p_recipient uuid) returns boolean
language sql stable security definer set search_path = public as $$
 select p_sender <> p_recipient
 and not exists(select 1 from public.user_blocks b where (b.blocker_id=p_sender and b.blocked_id=p_recipient) or (b.blocker_id=p_recipient and b.blocked_id=p_sender))
 and (public.has_role(p_sender,'verified') or public.has_role(p_sender,'coach') or public.has_role(p_sender,'moderator') or public.has_role(p_sender,'manager')
   or exists(select 1 from public.connections c where c.status='accepted' and ((c.requester_id=p_sender and c.recipient_id=p_recipient) or (c.requester_id=p_recipient and c.recipient_id=p_sender))));
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
 insert into public.profiles(user_id,display_name) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1))) on conflict do nothing;
 insert into public.user_roles(user_id,role) values(new.id,'member') on conflict do nothing;
 return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.enforce_post_rate_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare n integer; begin
 if not (public.has_role(new.author_id,'verified') or public.has_role(new.author_id,'coach') or public.has_role(new.author_id,'moderator') or public.has_role(new.author_id,'manager')) then raise exception 'النشر متاح للأعضاء الموثقين فقط'; end if;
 select count(*) into n from public.posts where author_id=new.author_id and created_at > now()-interval '24 hours';
 if n >= 5 then raise exception 'تم الوصول إلى الحد اليومي للمنشورات'; end if;
 return new;
end $$;
drop trigger if exists posts_daily_limit on public.posts;
create trigger posts_daily_limit before insert on public.posts for each row execute procedure public.enforce_post_rate_limit();

create or replace function public.enforce_message_rate_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare n integer; lim integer := 15; begin
 if public.has_role(new.sender_id,'verified') or public.has_role(new.sender_id,'coach') or public.has_role(new.sender_id,'moderator') or public.has_role(new.sender_id,'manager') then lim := 40; end if;
 select count(*) into n from public.messages where sender_id=new.sender_id and created_at > now()-interval '24 hours';
 if n >= lim then raise exception 'تم الوصول إلى الحد اليومي للرسائل'; end if;
 return new;
end $$;
drop trigger if exists messages_daily_limit on public.messages;
create trigger messages_daily_limit before insert on public.messages for each row execute procedure public.enforce_message_rate_limit();

create or replace function public.queue_verified_document_removal() returns trigger language plpgsql security definer set search_path = public as $$
begin
 if old.status='pending' and new.status in ('approved','rejected') and old.document_path is not null then
   insert into public.verification_cleanup_queue(bucket_id,object_path) values('verification-private',old.document_path);
 end if;
 return new;
end $$;
drop trigger if exists verification_file_cleanup_enqueue on public.verification_requests;
create trigger verification_file_cleanup_enqueue after update of status on public.verification_requests for each row execute procedure public.queue_verified_document_removal();

create trigger profiles_updated before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger verification_updated before update on public.verification_requests for each row execute procedure public.set_updated_at();
create trigger articles_updated before update on public.articles for each row execute procedure public.set_updated_at();
create trigger coaches_updated before update on public.coach_profiles for each row execute procedure public.set_updated_at();

-- RLS is the security boundary; UI role checks are only a convenience.
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.verification_requests enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.saved_posts enable row level security;
alter table public.connections enable row level security;
alter table public.user_blocks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.articles enable row level security;
alter table public.coach_profiles enable row level security;
alter table public.coach_availability enable row level security;
alter table public.coaching_bookings enable row level security;
alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.verification_cleanup_queue enable row level security;

create policy "Public or signed-in profile read" on public.profiles for select to anon,authenticated using (visibility='public' or user_id=auth.uid() or public.is_staff());
create policy "Owner updates profile" on public.profiles for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "Roles visible to signed in users" on public.user_roles for select to authenticated using (true);
create policy "Managers administer roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'manager')) with check (public.has_role(auth.uid(),'manager'));

create policy "Owner creates verification request" on public.verification_requests for insert to authenticated with check (user_id=auth.uid() and status='pending' and reviewer_id is null);
create policy "Owner and staff read verification" on public.verification_requests for select to authenticated using (user_id=auth.uid() or public.is_staff());
create policy "Owner edits pending request" on public.verification_requests for update to authenticated using (user_id=auth.uid() and status in ('pending','more_information')) with check (user_id=auth.uid() and status in ('pending','more_information') and reviewer_id is null);
create policy "Staff reviews verification" on public.verification_requests for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "Members read visible posts" on public.posts for select to authenticated using (moderation_state='visible' or author_id=auth.uid() or public.is_staff());
create policy "Verified publish posts" on public.posts for insert to authenticated with check (author_id=auth.uid() and (public.has_role(auth.uid(),'verified') or public.has_role(auth.uid(),'coach') or public.has_role(auth.uid(),'moderator') or public.has_role(auth.uid(),'manager')));
create policy "Authors or staff edit posts" on public.posts for update to authenticated using (author_id=auth.uid() or public.is_staff()) with check (author_id=auth.uid() or public.is_staff());
create policy "Authors or staff delete posts" on public.posts for delete to authenticated using (author_id=auth.uid() or public.is_staff());

create policy "Visible comments read" on public.comments for select to authenticated using (moderation_state='visible' or author_id=auth.uid() or public.is_staff());
create policy "Members comment on visible posts" on public.comments for insert to authenticated with check (author_id=auth.uid() and exists(select 1 from public.posts p where p.id=post_id and p.moderation_state='visible'));
create policy "Author or staff edit comments" on public.comments for update to authenticated using (author_id=auth.uid() or public.is_staff()) with check (author_id=auth.uid() or public.is_staff());
create policy "Author or staff delete comments" on public.comments for delete to authenticated using (author_id=auth.uid() or public.is_staff());

create policy "Members read likes" on public.post_likes for select to authenticated using (true);
create policy "Members like visible post" on public.post_likes for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.posts p where p.id=post_id and p.moderation_state='visible'));
create policy "Owner removes like" on public.post_likes for delete to authenticated using (user_id=auth.uid());
create policy "Users read own saved posts" on public.saved_posts for select to authenticated using (user_id=auth.uid());
create policy "Users save own posts" on public.saved_posts for insert to authenticated with check (user_id=auth.uid());
create policy "Users remove own saves" on public.saved_posts for delete to authenticated using (user_id=auth.uid());

create policy "Participants read connections" on public.connections for select to authenticated using (requester_id=auth.uid() or recipient_id=auth.uid() or public.is_staff());
create policy "Members request connection" on public.connections for insert to authenticated with check (requester_id=auth.uid() and status='pending');
create policy "Recipient or requester updates connection" on public.connections for update to authenticated using (requester_id=auth.uid() or recipient_id=auth.uid() or public.is_staff()) with check (requester_id=auth.uid() or recipient_id=auth.uid() or public.is_staff());
create policy "Participants delete connection" on public.connections for delete to authenticated using (requester_id=auth.uid() or recipient_id=auth.uid() or public.is_staff());

create policy "Users read their blocks" on public.user_blocks for select to authenticated using (blocker_id=auth.uid() or blocked_id=auth.uid());
create policy "Users block accounts" on public.user_blocks for insert to authenticated with check (blocker_id=auth.uid());
create policy "Blocker removes block" on public.user_blocks for delete to authenticated using (blocker_id=auth.uid());

create policy "Conversation participant reads" on public.conversations for select to authenticated using (member_a=auth.uid() or member_b=auth.uid() or public.is_staff());
create policy "Conversation participant creates" on public.conversations for insert to authenticated with check (auth.uid() in (member_a,member_b) and public.can_message(auth.uid(),case when auth.uid()=member_a then member_b else member_a end));
create policy "Conversation participant deletes" on public.conversations for delete to authenticated using (member_a=auth.uid() or member_b=auth.uid() or public.is_staff());
create policy "Conversation members read messages" on public.messages for select to authenticated using (exists(select 1 from public.conversations c where c.id=conversation_id and auth.uid() in (c.member_a,c.member_b)) or public.is_staff());
create policy "Eligible users send messages" on public.messages for insert to authenticated with check (sender_id=auth.uid() and public.can_message(sender_id,recipient_id) and exists(select 1 from public.conversations c where c.id=conversation_id and ((c.member_a=sender_id and c.member_b=recipient_id) or (c.member_b=sender_id and c.member_a=recipient_id))));
create policy "Recipient marks message read" on public.messages for update to authenticated using (recipient_id=auth.uid() or public.is_staff()) with check (recipient_id=auth.uid() or public.is_staff());

create policy "Recipients read notifications" on public.notifications for select to authenticated using (recipient_id=auth.uid() or public.is_staff());
create policy "Recipients update notifications" on public.notifications for update to authenticated using (recipient_id=auth.uid()) with check (recipient_id=auth.uid());
create policy "Recipients delete notifications" on public.notifications for delete to authenticated using (recipient_id=auth.uid());
-- Notification insertion is server/trigger only; no client INSERT policy is intentionally created.

create policy "Public groups or members read" on public.groups for select to anon,authenticated using ((is_public and moderation_state='active') or owner_id=auth.uid() or public.is_staff() or exists(select 1 from public.group_memberships gm where gm.group_id=id and gm.user_id=auth.uid() and gm.status='active'));
create policy "Verified create groups" on public.groups for insert to authenticated with check (owner_id=auth.uid() and (public.has_role(auth.uid(),'verified') or public.has_role(auth.uid(),'coach') or public.has_role(auth.uid(),'manager')));
create policy "Group owner or staff update" on public.groups for update to authenticated using (owner_id=auth.uid() or public.is_staff()) with check (owner_id=auth.uid() or public.is_staff());
create policy "Group owner or staff delete" on public.groups for delete to authenticated using (owner_id=auth.uid() or public.is_staff());
create policy "Members read own memberships" on public.group_memberships for select to authenticated using (user_id=auth.uid() or exists(select 1 from public.groups g where g.id=group_id and g.owner_id=auth.uid()) or public.is_staff());
create policy "Members request or join" on public.group_memberships for insert to authenticated with check (user_id=auth.uid());
create policy "Member or group owner updates membership" on public.group_memberships for update to authenticated using (user_id=auth.uid() or exists(select 1 from public.groups g where g.id=group_id and g.owner_id=auth.uid()) or public.is_staff()) with check (user_id=auth.uid() or exists(select 1 from public.groups g where g.id=group_id and g.owner_id=auth.uid()) or public.is_staff());
create policy "Member leaves group" on public.group_memberships for delete to authenticated using (user_id=auth.uid() or public.is_staff());

create policy "Published events visible" on public.events for select to anon,authenticated using ((not is_private and moderation_state='visible') or organizer_id=auth.uid() or public.is_staff());
create policy "Verified events create" on public.events for insert to authenticated with check (organizer_id=auth.uid() and (public.has_role(auth.uid(),'verified') or public.has_role(auth.uid(),'coach') or public.has_role(auth.uid(),'manager')));
create policy "Organizer or staff updates events" on public.events for update to authenticated using (organizer_id=auth.uid() or public.is_staff()) with check (organizer_id=auth.uid() or public.is_staff());
create policy "Organizer or staff removes events" on public.events for delete to authenticated using (organizer_id=auth.uid() or public.is_staff());
create policy "RSVPs visible to self and organizer" on public.event_rsvps for select to authenticated using (user_id=auth.uid() or exists(select 1 from public.events e where e.id=event_id and e.organizer_id=auth.uid()) or public.is_staff());
create policy "Members RSVP" on public.event_rsvps for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.events e where e.id=event_id and not e.is_private));
create policy "Member updates own RSVP" on public.event_rsvps for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "Member cancels own RSVP" on public.event_rsvps for delete to authenticated using (user_id=auth.uid() or public.is_staff());

create policy "Published articles public" on public.articles for select to anon,authenticated using (status='published' or author_id=auth.uid() or public.is_staff());
create policy "Verified authors create articles" on public.articles for insert to authenticated with check (author_id=auth.uid() and (public.has_role(auth.uid(),'verified') or public.has_role(auth.uid(),'coach') or public.has_role(auth.uid(),'manager')));
create policy "Author or staff edits articles" on public.articles for update to authenticated using (author_id=auth.uid() or public.is_staff()) with check (author_id=auth.uid() or public.is_staff());
create policy "Author or staff deletes articles" on public.articles for delete to authenticated using (author_id=auth.uid() or public.is_staff());

create policy "Coach pages public" on public.coach_profiles for select to anon,authenticated using (public.has_role(user_id,'coach') or user_id=auth.uid() or public.is_staff());
create policy "Coach owns coach page" on public.coach_profiles for insert to authenticated with check (user_id=auth.uid() and public.has_role(auth.uid(),'coach'));
create policy "Coach updates own page" on public.coach_profiles for update to authenticated using (user_id=auth.uid() and public.has_role(auth.uid(),'coach')) with check (user_id=auth.uid() and public.has_role(auth.uid(),'coach'));
create policy "Coach or staff deletes coach page" on public.coach_profiles for delete to authenticated using (user_id=auth.uid() or public.is_staff());
create policy "Availability read by coach or signed-in member" on public.coach_availability for select to authenticated using (is_available or coach_id=auth.uid() or public.is_staff());
create policy "Coach manages availability" on public.coach_availability for all to authenticated using (coach_id=auth.uid() and public.has_role(auth.uid(),'coach')) with check (coach_id=auth.uid() and public.has_role(auth.uid(),'coach'));
create policy "Booking parties read" on public.coaching_bookings for select to authenticated using (member_id=auth.uid() or coach_id=auth.uid() or public.is_staff());
create policy "Members request coach booking" on public.coaching_bookings for insert to authenticated with check (member_id=auth.uid() and exists(select 1 from public.user_roles r where r.user_id=coach_id and r.role='coach'));
create policy "Booking parties update" on public.coaching_bookings for update to authenticated using (member_id=auth.uid() or coach_id=auth.uid() or public.is_staff()) with check (member_id=auth.uid() or coach_id=auth.uid() or public.is_staff());

create policy "Active membership plans public" on public.membership_plans for select to anon,authenticated using (is_active or public.is_staff());
create policy "Managers administer membership plans" on public.membership_plans for all to authenticated using (public.has_role(auth.uid(),'manager')) with check (public.has_role(auth.uid(),'manager'));
create policy "Members read own membership" on public.memberships for select to authenticated using (user_id=auth.uid() or public.is_staff());
create policy "Managers administer memberships" on public.memberships for all to authenticated using (public.has_role(auth.uid(),'manager')) with check (public.has_role(auth.uid(),'manager'));

create policy "Users submit reports" on public.reports for insert to authenticated with check (reporter_id=auth.uid());
create policy "Reporter or staff reads reports" on public.reports for select to authenticated using (reporter_id=auth.uid() or public.is_staff());
create policy "Staff updates reports" on public.reports for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Reporter or staff removes reports" on public.reports for delete to authenticated using (reporter_id=auth.uid() or public.is_staff());
create policy "Staff reads moderation history" on public.moderation_actions for select to authenticated using (public.is_staff());
create policy "Staff records moderation action" on public.moderation_actions for insert to authenticated with check (public.is_staff() and moderator_id=auth.uid());
create policy "Staff reads cleanup queue" on public.verification_cleanup_queue for select to authenticated using (public.is_staff());
-- Cleanup queue mutations are service-role only; no anon/authenticated write policy.

-- All records inherit table privileges only for intended APIs. RLS still filters every row.
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.articles, public.groups, public.events, public.membership_plans to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.user_roles to authenticated;
grant execute on function public.has_role(uuid,public.app_role) to anon,authenticated;
grant execute on function public.is_staff(uuid) to anon,authenticated;
grant execute on function public.can_message(uuid,uuid) to authenticated;

-- Private bucket; reviewer-approved/rejected documents are queued for removal by the Edge Function.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('verification-private','verification-private',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false, file_size_limit=10485760, allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'];
create policy "Owner uploads own verification document" on storage.objects for insert to authenticated with check (bucket_id='verification-private' and (storage.foldername(name))[1]=auth.uid()::text and array_length(storage.foldername(name),1)=1);
create policy "Staff reads verification documents" on storage.objects for select to authenticated using (bucket_id='verification-private' and array_length(storage.foldername(name),1)=1 and public.is_staff());
create policy "Owner or staff removes own pending document" on storage.objects for delete to authenticated using (bucket_id='verification-private' and array_length(storage.foldername(name),1)=1 and (public.is_staff() or (storage.foldername(name))[1]=auth.uid()::text));



-- ===== Source: supabase/migrations/202610020002_policy_hardening.sql =====
-- Security hardening and transition rules for the initial schema.

-- A pending request can only be accepted/declined by its recipient; requester can cancel only.
create or replace function public.guard_connection_transition() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' or public.is_staff(auth.uid()) then return new; end if;
  if auth.uid() = old.recipient_id and old.status = 'pending'
     and new.status in ('accepted','declined')
     and new.requester_id = old.requester_id and new.recipient_id = old.recipient_id then
    new.responded_at := now(); return new;
  end if;
  if auth.uid() = old.requester_id and old.status = 'pending'
     and new.status = 'declined'
     and new.requester_id = old.requester_id and new.recipient_id = old.recipient_id then
    new.responded_at := now(); return new;
  end if;
  raise exception 'Only the recipient can accept or decline a pending connection; the requester may cancel it.';
end $$;
drop trigger if exists connections_guard_transition on public.connections;
create trigger connections_guard_transition before update on public.connections
for each row execute procedure public.guard_connection_transition();

-- A private group request is pending until its owner/moderator activates it.
drop policy if exists "Members request or join" on public.group_memberships;
create policy "Members request or join" on public.group_memberships for insert to authenticated
with check (
  user_id=auth.uid() and (
    status='pending' or (status='active' and exists(select 1 from public.groups g where g.id=group_id and g.is_public=true))
  )
);
drop policy if exists "Member or group owner updates membership" on public.group_memberships;
create policy "Member or group owner updates membership" on public.group_memberships for update to authenticated
using (user_id=auth.uid() or exists(select 1 from public.groups g where g.id=group_id and g.owner_id=auth.uid()) or public.is_staff())
with check (
  (user_id=auth.uid() and status in ('pending','removed'))
  or exists(select 1 from public.groups g where g.id=group_id and g.owner_id=auth.uid())
  or public.is_staff()
);

-- Respect post visibility at the parent row; comments/likes cannot leak a connection-only post.
drop policy if exists "Members read visible posts" on public.posts;
create policy "Members read visible posts" on public.posts for select to authenticated
using (
  (moderation_state='visible' and (
    author_id=auth.uid() or public.is_staff() or visibility in ('public','members')
    or (visibility='connections' and exists(
      select 1 from public.connections c where c.status='accepted'
      and ((c.requester_id=auth.uid() and c.recipient_id=posts.author_id)
        or (c.requester_id=posts.author_id and c.recipient_id=auth.uid()))
    ))
  )) or author_id=auth.uid() or public.is_staff()
);
drop policy if exists "Visible comments read" on public.comments;
create policy "Visible comments read" on public.comments for select to authenticated
using (
  author_id=auth.uid() or public.is_staff() or (
    moderation_state='visible' and exists(select 1 from public.posts p where p.id=post_id and p.moderation_state='visible')
  )
);
drop policy if exists "Members read likes" on public.post_likes;
create policy "Members read likes" on public.post_likes for select to authenticated
using (
  user_id=auth.uid() or public.is_staff() or exists(select 1 from public.posts p where p.id=post_id and p.moderation_state='visible')
);

-- Staff decisions run through one auditable transaction. Approval grants the verified role.
drop policy if exists "Staff reviews verification" on public.verification_requests;
create or replace function public.review_verification_request(
  p_request_id uuid,
  p_decision public.review_state,
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_request public.verification_requests;
begin
  if auth.uid() is null or not public.is_staff(auth.uid()) then raise exception 'Staff access required'; end if;
  if p_decision not in ('approved','rejected','more_information') then raise exception 'Unsupported verification decision'; end if;
  if p_decision='rejected' and coalesce(nullif(trim(p_reason),''),'')='' then raise exception 'A rejection reason is required'; end if;
  update public.verification_requests
     set status=p_decision, decision_reason=nullif(trim(p_reason),''), reviewer_id=auth.uid(), reviewed_at=now()
   where id=p_request_id and status in ('pending','more_information')
   returning * into v_request;
  if not found then raise exception 'Request not found or already finalized'; end if;
  if p_decision='approved' then
    insert into public.user_roles(user_id,role,granted_by) values(v_request.user_id,'verified',auth.uid())
    on conflict (user_id,role) do nothing;
  end if;
  insert into public.moderation_actions(moderator_id,subject_user_id,target_type,target_id,action,reason)
  values(auth.uid(),v_request.user_id,'verification_request',v_request.id,'verification_decision',coalesce(p_reason,''));
  return to_jsonb(v_request);
end $$;
grant execute on function public.review_verification_request(uuid,public.review_state,text) to authenticated;

-- Queue the previous upload if replaced; queue the final upload on accept/reject, including after more-information.
create or replace function public.queue_verified_document_removal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.document_path is not null and old.document_path is distinct from new.document_path then
    insert into public.verification_cleanup_queue(bucket_id,object_path) values('verification-private',old.document_path);
  elsif old.status in ('pending','more_information') and new.status in ('approved','rejected') and old.document_path is not null then
    insert into public.verification_cleanup_queue(bucket_id,object_path) values('verification-private',old.document_path);
  end if;
  return new;
end $$;
drop trigger if exists verification_file_cleanup_enqueue on public.verification_requests;
create trigger verification_file_cleanup_enqueue after update on public.verification_requests
for each row execute procedure public.queue_verified_document_removal();

-- Enable low-latency Postgres Changes for the signed-in social experience where Supabase's publication exists.
do $$
declare t text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['messages','notifications','posts','connections'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;



-- ===== Source: supabase/migrations/202610020003_guest_scope_and_atomic_limits.sql =====
-- Restrict visitor data access and serialize rate-limit checks.

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



-- ===== Source: supabase/migrations/202610020004_integrity_and_storage_scope.sql =====
-- Final integrity guards for paths, content state, bookings, and participant-controlled mutations.

-- Verification object names are always exactly <own-user-uuid>/<filename>.
create or replace function public.guard_verification_document_path() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner_id uuid;
begin
  if auth.role()='service_role' then return new; end if;
  owner_id := coalesce(auth.uid(),new.user_id);
  if owner_id is null or new.user_id <> owner_id
     or split_part(new.document_path,'/',1) <> owner_id::text
     or array_length(string_to_array(new.document_path,'/'),1) <> 2
     or split_part(new.document_path,'/',2) = '' then
    raise exception 'Verification files must be stored under the requesting account folder.';
  end if;
  return new;
end $$;
drop trigger if exists verification_document_path_guard on public.verification_requests;
create trigger verification_document_path_guard before insert or update of document_path,user_id on public.verification_requests
for each row execute procedure public.guard_verification_document_path();

drop policy if exists "Owner uploads own verification document" on storage.objects;
create policy "Owner uploads own verification document" on storage.objects for insert to authenticated
with check (bucket_id='verification-private' and (storage.foldername(name))[1]=auth.uid()::text and array_length(storage.foldername(name),1)=1);
drop policy if exists "Pending owner or staff reads verification document" on storage.objects;
drop policy if exists "Staff reads verification documents" on storage.objects;
create policy "Staff reads verification documents" on storage.objects for select to authenticated
using (bucket_id='verification-private' and array_length(storage.foldername(name),1)=1 and public.is_staff());
drop policy if exists "Owner or staff removes own pending document" on storage.objects;
create policy "Owner or staff removes own pending document" on storage.objects for delete to authenticated
using (bucket_id='verification-private' and array_length(storage.foldername(name),1)=1 and
 (public.is_staff() or (storage.foldername(name))[1]=auth.uid()::text));

-- The anonymous coach directory is only the explicitly whitelisted view; never expose coach_profiles directly.
drop policy if exists "Coach pages public" on public.coach_profiles;
revoke all on public.coach_profiles from anon;
create policy "Signed-in coach profile access" on public.coach_profiles for select to authenticated
using (user_id=auth.uid() or public.is_staff() or (public.has_role(user_id,'coach') and exists(select 1 from public.profiles p where p.user_id=coach_profiles.user_id and p.visibility='public')));

-- Even a row's creator can only read its comment/like while the parent post is visible to them.
drop policy if exists "Visible comments read" on public.comments;
create policy "Visible comments read" on public.comments for select to authenticated
using (public.is_staff() or (moderation_state='visible' and exists(select 1 from public.posts p where p.id=post_id and p.moderation_state='visible')));
drop policy if exists "Members read likes" on public.post_likes;
create policy "Members read likes" on public.post_likes for select to authenticated
using (public.is_staff() or exists(select 1 from public.posts p where p.id=post_id and p.moderation_state='visible'));

-- Only organizers can RSVP to a public event; changing an RSVP cannot bypass the insert rule.
drop policy if exists "Member updates own RSVP" on public.event_rsvps;
create policy "Member updates own RSVP" on public.event_rsvps for update to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid() and exists(select 1 from public.events e where e.id=event_id and not e.is_private and e.moderation_state='visible'));

-- Authors may edit their text, but cannot undo staff moderation or impersonate another author.
create or replace function public.guard_content_moderation_state() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role()='service_role' or public.is_staff(auth.uid()) then return new; end if;
  if new.id is distinct from old.id or to_jsonb(new)->>'author_id' is distinct from to_jsonb(old)->>'author_id'
     or new.created_at is distinct from old.created_at or new.moderation_state is distinct from old.moderation_state then
    raise exception 'Only staff can change content identity or moderation state.';
  end if;
  return new;
end $$;
drop trigger if exists posts_moderation_guard on public.posts;
create trigger posts_moderation_guard before update on public.posts for each row execute procedure public.guard_content_moderation_state();
drop trigger if exists comments_moderation_guard on public.comments;
create trigger comments_moderation_guard before update on public.comments for each row execute procedure public.guard_content_moderation_state();

drop trigger if exists groups_moderation_guard on public.groups;
create trigger groups_moderation_guard before update on public.groups for each row execute procedure public.guard_content_moderation_state();
drop trigger if exists events_moderation_guard on public.events;
create trigger events_moderation_guard before update on public.events for each row execute procedure public.guard_content_moderation_state();
create or replace function public.guard_article_publication() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role()='service_role' or public.is_staff(auth.uid()) then return new; end if;
  if new.id is distinct from old.id or new.author_id is distinct from old.author_id
     or (new.status is distinct from old.status and not (public.has_role(auth.uid(),'verified') or public.has_role(auth.uid(),'coach') or public.has_role(auth.uid(),'manager'))) then
    raise exception 'Only an eligible author or staff may change publication state.';
  end if;
  return new;
end $$;
drop trigger if exists articles_publication_guard on public.articles;
create trigger articles_publication_guard before update on public.articles for each row execute procedure public.guard_article_publication();

-- A recipient may only mark a message read; participants cannot rewrite authorship or the conversation.
create or replace function public.guard_message_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role()='service_role' or public.is_staff(auth.uid()) then return new; end if;
  if auth.uid()=old.recipient_id and new.id=old.id and new.conversation_id=old.conversation_id
     and new.sender_id=old.sender_id and new.recipient_id=old.recipient_id and new.body=old.body
     and new.created_at=old.created_at and new.moderation_state=old.moderation_state and new.read_at is not null then
    return new;
  end if;
  raise exception 'Recipients may only mark their messages as read.';
end $$;
drop trigger if exists messages_update_guard on public.messages;
create trigger messages_update_guard before update on public.messages for each row execute procedure public.guard_message_update();
create or replace function public.guard_notification_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role()='service_role' or public.is_staff(auth.uid()) then return new; end if;
  if auth.uid()=old.recipient_id and new.id=old.id and new.recipient_id=old.recipient_id
     and new.actor_id is not distinct from old.actor_id and new.kind=old.kind
     and new.entity_type is not distinct from old.entity_type and new.entity_id is not distinct from old.entity_id
     and new.body=old.body and new.created_at=old.created_at then return new; end if;
  raise exception 'Recipients may only update notification read state.';
end $$;
drop trigger if exists notifications_update_guard on public.notifications;
create trigger notifications_update_guard before update on public.notifications for each row execute procedure public.guard_notification_update();

-- Coach-only acceptance/decline; members may cancel, but cannot accept their own booking.
create or replace function public.guard_booking_transition() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role()='service_role' or public.is_staff(auth.uid()) then return new; end if;
  if new.id is distinct from old.id or new.coach_id is distinct from old.coach_id
     or new.member_id is distinct from old.member_id or new.created_at is distinct from old.created_at then
    raise exception 'Booking participants and identity are immutable.';
  end if;
  if auth.uid()=old.coach_id and old.status='requested' and new.status in ('accepted','declined') then return new; end if;
  if auth.uid()=old.member_id and old.status in ('requested','accepted') and new.status='cancelled' then return new; end if;
  raise exception 'Only the coach can accept or decline; the member can cancel.';
end $$;
drop trigger if exists coaching_booking_transition_guard on public.coaching_bookings;
create trigger coaching_booking_transition_guard before update on public.coaching_bookings for each row execute procedure public.guard_booking_transition();

-- Staff may update a report's workflow state, but its submitted evidence is immutable.
create or replace function public.guard_report_transition() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role()='service_role' then return new; end if;
  if not public.is_staff(auth.uid()) then raise exception 'Staff access required to update reports.'; end if;
  if new.id is distinct from old.id or new.reporter_id is distinct from old.reporter_id
     or new.target_type is distinct from old.target_type or new.target_id is distinct from old.target_id
     or new.reason is distinct from old.reason or new.details is distinct from old.details
     or new.created_at is distinct from old.created_at then
    raise exception 'Report evidence and identity are immutable.';
  end if;
  new.moderator_id := auth.uid();
  if new.status in ('resolved','dismissed') then new.resolved_at := coalesce(old.resolved_at,now());
  else new.resolved_at := null; end if;
  return new;
end $$;
drop trigger if exists reports_transition_guard on public.reports;
create trigger reports_transition_guard before update on public.reports for each row execute procedure public.guard_report_transition();



-- ===== Source: supabase/migrations/202610020005_least_privilege_and_booking_rules.sql =====
-- Least-privilege execution grants and authoritative booking/read-receipt transitions.

-- has_role remains available to authenticated members for role-aware policies/UI, never to anonymous visitors.
revoke all on function public.has_role(uuid,public.app_role) from public,anon;
grant execute on function public.has_role(uuid,public.app_role) to authenticated;
-- Policies call is_staff() for visitor/public-page filtering, so retain execution but never disclose another user's role.
create or replace function public.is_staff(p_user uuid default auth.uid()) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if p_user is distinct from auth.uid() then return false; end if;
  return public.has_role(p_user,'moderator') or public.has_role(p_user,'manager');
end $$;
grant execute on function public.is_staff(uuid) to anon,authenticated;
revoke all on function public.can_message(uuid,uuid) from public,anon;
grant execute on function public.can_message(uuid,uuid) to authenticated;
create or replace function public.can_message(p_sender uuid,p_recipient uuid) returns boolean
language sql stable security definer set search_path = public as $$
 select auth.uid() is not null and p_sender=auth.uid() and p_sender <> p_recipient
 and not exists(select 1 from public.user_blocks b where (b.blocker_id=p_sender and b.blocked_id=p_recipient) or (b.blocker_id=p_recipient and b.blocked_id=p_sender))
 and (public.has_role(p_sender,'verified') or public.has_role(p_sender,'coach') or public.has_role(p_sender,'moderator') or public.has_role(p_sender,'manager')
   or exists(select 1 from public.connections c where c.status='accepted' and ((c.requester_id=p_sender and c.recipient_id=p_recipient) or (c.requester_id=p_recipient and c.recipient_id=p_sender))));
$$;
revoke all on function public.review_verification_request(uuid,public.review_state,text) from public,anon;
grant execute on function public.review_verification_request(uuid,public.review_state,text) to authenticated;

-- Booking requests must be pending, enabled by the coach, and tied to that coach's valid available slot.
create or replace function public.guard_booking_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare slot public.coach_availability; coach public.coach_profiles;
begin
  if auth.role()='service_role' then return new; end if;
  if new.status <> 'requested' or (auth.uid() is not null and new.member_id <> auth.uid()) then
    raise exception 'Members may only create their own requested bookings.';
  end if;
  select * into coach from public.coach_profiles cp where cp.user_id=new.coach_id and cp.booking_enabled=true;
  if not found or not public.has_role(new.coach_id,'coach') then raise exception 'Coach bookings are not enabled.'; end if;
  if new.availability_id is null then raise exception 'Choose an available coaching slot.'; end if;
  select * into slot from public.coach_availability a where a.id=new.availability_id and a.coach_id=new.coach_id and a.is_available=true for update;
  if not found or slot.starts_at <> new.starts_at or new.minutes <> any(coach.session_minutes)
     or new.minutes*60 > extract(epoch from (slot.ends_at-slot.starts_at)) then
    raise exception 'The selected slot is unavailable or incompatible with the session length.';
  end if;
  return new;
end $$;
drop trigger if exists coaching_booking_insert_guard on public.coaching_bookings;
create trigger coaching_booking_insert_guard before insert on public.coaching_bookings for each row execute procedure public.guard_booking_insert();
create unique index if not exists coaching_bookings_one_active_slot_idx on public.coaching_bookings(availability_id)
where availability_id is not null and status in ('requested','accepted');

create or replace function public.guard_booking_transition() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role()='service_role' or public.is_staff(auth.uid()) then return new; end if;
  if new.id is distinct from old.id or new.coach_id is distinct from old.coach_id
     or new.member_id is distinct from old.member_id or new.created_at is distinct from old.created_at
     or new.availability_id is distinct from old.availability_id or new.starts_at is distinct from old.starts_at
     or new.minutes is distinct from old.minutes or new.member_note is distinct from old.member_note then
    raise exception 'Booking identity and scheduled details are immutable after request.';
  end if;
  if auth.uid()=old.coach_id and old.status='requested' and new.status in ('accepted','declined') then return new; end if;
  if auth.uid()=old.member_id and old.status in ('requested','accepted') and new.status='cancelled' then return new; end if;
  raise exception 'Only the coach can accept or decline; the member can cancel.';
end $$;

-- Hold a selected slot while requested/accepted, and release it after cancellation or decline.
create or replace function public.sync_coach_availability() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op='INSERT' then
    if new.availability_id is not null then update public.coach_availability set is_available=false where id=new.availability_id; end if;
    return new;
  end if;
  if old.availability_id is not null and old.status in ('requested','accepted') and new.status in ('declined','cancelled') then
    update public.coach_availability set is_available=true where id=old.availability_id;
  end if;
  return new;
end $$;
drop trigger if exists coaching_booking_slot_sync on public.coaching_bookings;
create trigger coaching_booking_slot_sync after insert or update of status on public.coaching_bookings
for each row execute procedure public.sync_coach_availability();

-- Read timestamps are set once by the database, not chosen by the recipient.
create or replace function public.guard_message_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role()='service_role' or public.is_staff(auth.uid()) then return new; end if;
  if auth.uid()=old.recipient_id and old.read_at is null and new.id=old.id and new.conversation_id=old.conversation_id
     and new.sender_id=old.sender_id and new.recipient_id=old.recipient_id and new.body=old.body
     and new.created_at=old.created_at and new.moderation_state=old.moderation_state and new.read_at is not null then
    new.read_at := now(); return new;
  end if;
  raise exception 'Recipients may only mark an unread message as read once.';
end $$;



-- ===== Source: supabase/migrations/202610020006_coach_schedule_completion.sql =====
-- Final least-privilege and coaching-schedule lifecycle fixes.

-- The helper is intentionally callable only by the two Supabase API roles used in policies.
revoke all on function public.is_staff(uuid) from public;
grant execute on function public.is_staff(uuid) to anon,authenticated;

-- Prevent two availability records for one coach from overlapping in time.
create or replace function public.guard_coach_availability_overlap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('saytara-availability:'||new.coach_id::text,0));
  if exists (
    select 1 from public.coach_availability a
    where a.coach_id=new.coach_id and a.id is distinct from new.id
      and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')
  ) then raise exception 'Coach availability slots may not overlap.'; end if;
  return new;
end $$;
drop trigger if exists coach_availability_overlap_guard on public.coach_availability;
create trigger coach_availability_overlap_guard before insert or update on public.coach_availability
for each row execute procedure public.guard_coach_availability_overlap();

-- The dev seed is safely re-runnable: an existing fixture booking is a no-op before slot validation.
create or replace function public.guard_booking_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare slot public.coach_availability; coach public.coach_profiles;
begin
  if auth.role()='service_role' then return new; end if;
  if exists(select 1 from public.coaching_bookings b where b.id=new.id) then return null; end if;
  if new.status <> 'requested' or (auth.uid() is not null and new.member_id <> auth.uid()) then
    raise exception 'Members may only create their own requested bookings.';
  end if;
  select * into coach from public.coach_profiles cp where cp.user_id=new.coach_id and cp.booking_enabled=true;
  if not found or not public.has_role(new.coach_id,'coach') then raise exception 'Coach bookings are not enabled.'; end if;
  if new.availability_id is null then raise exception 'Choose an available coaching slot.'; end if;
  select * into slot from public.coach_availability a where a.id=new.availability_id and a.coach_id=new.coach_id and a.is_available=true for update;
  if not found or slot.starts_at <> new.starts_at or new.minutes <> any(coach.session_minutes)
     or new.minutes*60 > extract(epoch from (slot.ends_at-slot.starts_at)) then
    raise exception 'The selected slot is unavailable or incompatible with the session length.';
  end if;
  return new;
end $$;

-- Coaches may mark an accepted booking completed only after the scheduled session window.
create or replace function public.guard_booking_transition() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role()='service_role' or public.is_staff(auth.uid()) then return new; end if;
  if new.id is distinct from old.id or new.coach_id is distinct from old.coach_id
     or new.member_id is distinct from old.member_id or new.created_at is distinct from old.created_at
     or new.availability_id is distinct from old.availability_id or new.starts_at is distinct from old.starts_at
     or new.minutes is distinct from old.minutes or new.member_note is distinct from old.member_note then
    raise exception 'Booking identity and scheduled details are immutable after request.';
  end if;
  if auth.uid()=old.coach_id and old.status='requested' and new.status in ('accepted','declined') then return new; end if;
  if auth.uid()=old.coach_id and old.status='accepted' and new.status='completed'
     and now() >= old.starts_at + make_interval(mins => old.minutes) then return new; end if;
  if auth.uid()=old.member_id and old.status in ('requested','accepted') and new.status='cancelled' then return new; end if;
  raise exception 'Only the coach can accept, decline, or complete after the session; the member can cancel.';
end $$;



-- ===== Source: supabase/migrations/202610020007_google_profile_provisioning.sql =====
-- مجتمع السيطرة — map verified Supabase Auth metadata into a safe default member profile.
-- Additive migration: keep migrations 001–006 immutable for projects that already applied them.

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



-- ===== Source: supabase/migrations/202610020008_server_timestamps_for_rate_limits.sql =====
-- مجتمع السيطرة — prevent client-supplied timestamps from bypassing rolling write limits.
-- Preserve the per-user transaction advisory lock introduced in migration 003.

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



-- ===== Source: supabase/migrations/202610020009_review_independence_and_read_receipts.sql =====
-- مجتمع السيطرة — reviewer independence and immutable read receipts.
-- Additive migration; keep the original migration history unchanged.

create or replace function public.review_verification_request(
  p_request_id uuid,
  p_decision public.review_state,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.verification_requests;
  v_target_user_id uuid;
begin
  if auth.uid() is null or not public.is_staff(auth.uid()) then
    raise exception 'Staff access required';
  end if;
  if p_decision not in ('approved','rejected','more_information') then
    raise exception 'Unsupported verification decision';
  end if;
  if p_decision='rejected' and coalesce(nullif(trim(p_reason),''),'')='' then
    raise exception 'A rejection reason is required';
  end if;

  select user_id into v_target_user_id
  from public.verification_requests
  where id=p_request_id
  for update;
  if not found then raise exception 'Request not found or already finalized'; end if;
  if v_target_user_id=auth.uid() then
    raise exception 'Staff cannot review their own verification request';
  end if;

  update public.verification_requests
     set status=p_decision,
         decision_reason=nullif(trim(p_reason),''),
         reviewer_id=auth.uid(),
         reviewed_at=clock_timestamp()
   where id=p_request_id and status in ('pending','more_information')
   returning * into v_request;
  if not found then raise exception 'Request not found or already finalized'; end if;

  if p_decision='approved' then
    insert into public.user_roles(user_id,role,granted_by)
    values(v_request.user_id,'verified',auth.uid())
    on conflict (user_id,role) do nothing;
  end if;

  insert into public.moderation_actions(moderator_id,subject_user_id,target_type,target_id,action,reason)
  values(auth.uid(),v_request.user_id,'verification_request',v_request.id,'verification_decision',coalesce(p_reason,''));
  return to_jsonb(v_request);
end $$;
revoke all on function public.review_verification_request(uuid,public.review_state,text) from public,anon;
grant execute on function public.review_verification_request(uuid,public.review_state,text) to authenticated;

create or replace function public.guard_message_update() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role()='service_role' or public.is_staff(auth.uid()) then return new; end if;

  if new.id is distinct from old.id
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at
     or new.moderation_state is distinct from old.moderation_state then
    raise exception 'Recipients may only mark their messages as read.';
  end if;

  if auth.uid()=old.recipient_id then
    if old.read_at is null and new.read_at is not null then
      new.read_at := clock_timestamp();
      return new;
    end if;
    if new.read_at is not distinct from old.read_at then return new; end if;
  end if;

  raise exception 'Recipients may only mark their messages as read once.';
end $$;



-- ===== Source: supabase/migrations/202610020010_is_staff_acl_and_audit_retention.sql =====
-- مجتمع السيطرة — preserve moderation audit rows when a moderator deletes their account.

-- Keep moderation history if its author later deletes their account; preserve the row,
-- but remove the deleted account reference instead of blocking auth.admin.deleteUser().
alter table public.moderation_actions
  alter column moderator_id drop not null;
alter table public.moderation_actions
  drop constraint if exists moderation_actions_moderator_id_fkey;
alter table public.moderation_actions
  add constraint moderation_actions_moderator_id_fkey
  foreign key (moderator_id) references auth.users(id) on delete set null;



-- ===== Source: supabase/migrations/202610020011_coach_duration_membership.sql =====
-- مجتمع السيطرة — use proper array membership when validating coach session durations.

create or replace function public.guard_booking_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  slot public.coach_availability;
  coach public.coach_profiles;
begin
  if auth.role()='service_role' then return new; end if;
  if exists(select 1 from public.coaching_bookings b where b.id=new.id) then return null; end if;
  if new.status <> 'requested' or (auth.uid() is not null and new.member_id <> auth.uid()) then
    raise exception 'Members may only create their own requested bookings.';
  end if;
  select * into coach from public.coach_profiles cp where cp.user_id=new.coach_id and cp.booking_enabled=true;
  if not found or not public.has_role(new.coach_id,'coach') then raise exception 'Coach bookings are not enabled.'; end if;
  if new.availability_id is null then raise exception 'Choose an available coaching slot.'; end if;
  select * into slot from public.coach_availability a
  where a.id=new.availability_id and a.coach_id=new.coach_id and a.is_available=true
  for update;
  if not found or slot.starts_at <> new.starts_at
     or not (new.minutes = any(coach.session_minutes))
     or new.minutes*60 > extract(epoch from (slot.ends_at-slot.starts_at)) then
    raise exception 'The selected slot is unavailable or incompatible with the session length.';
  end if;
  return new;
end $$;



-- ===== Source: supabase/migrations/202610020012_validate_existing_coach_slots.sql =====
-- مجتمع السيطرة — reject legacy rows that violate the protected storage/schedule invariants.

do $$
declare
  conflict_row record;
begin
  select a.coach_id, a.id as first_slot_id, b.id as second_slot_id
    into conflict_row
  from public.coach_availability a
  join public.coach_availability b
    on b.coach_id=a.coach_id
   and b.id>a.id
   and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')
  limit 1;

  if found then
    raise exception 'Existing overlapping coach availability slots must be reconciled before continuing. coach_id=%, slot_ids=%,%',
      conflict_row.coach_id, conflict_row.first_slot_id, conflict_row.second_slot_id;
  end if;

  select id, user_id, document_path
    into conflict_row
  from public.verification_requests
  where split_part(document_path,'/',1) <> user_id::text
     or array_length(string_to_array(document_path,'/'),1) <> 2
     or split_part(document_path,'/',2) = ''
  limit 1;

  if found then
    raise exception 'Existing verification request has a non-canonical document path. request_id=%, user_id=%, path=%',
      conflict_row.id, conflict_row.user_id, conflict_row.document_path;
  end if;
end $$;



-- ===== Source: supabase/migrations/202610020013_group_rls_no_recursion.sql =====
-- مجتمع السيطرة — break the groups/group_memberships RLS recursion without exposing arbitrary-user lookups.

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



-- ===== Source: supabase/migrations/202610030001_account_approval_gate.sql =====
-- Migration 014 — email-confirmed accounts stay pending until manager approval.
-- Existing profiles are preserved as approved; new Auth users are explicitly pending.
-- Apply to an existing Supabase project only after reviewing the change and taking a backup.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_reviewed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_review_reason text;

-- Preserve access for existing confirmed members. Old unconfirmed sign-ups must still
-- confirm email and then enter the manager queue; they are not silently activated.
UPDATE public.profiles p
SET account_status = CASE WHEN EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = p.user_id AND u.email_confirmed_at IS NOT NULL
) THEN 'approved' ELSE 'pending' END
WHERE p.account_status IS NULL;
ALTER TABLE public.profiles ALTER COLUMN account_status SET DEFAULT 'pending';
ALTER TABLE public.profiles ALTER COLUMN account_status SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_account_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_status_check
      CHECK (account_status IN ('pending','approved','rejected'));
  END IF;
END $$;

ALTER TABLE public.moderation_actions
  DROP CONSTRAINT IF EXISTS moderation_actions_action_check;
ALTER TABLE public.moderation_actions
  ADD CONSTRAINT moderation_actions_action_check
  CHECK (action IN ('hide','remove','restore','suspend','unsuspend','verification_decision','account_decision'));

-- This helper always evaluates the caller's own account; SECURITY DEFINER bypasses
-- profiles RLS so the pending user's own status can be checked without recursion.
CREATE OR REPLACE FUNCTION public.is_account_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT p.account_status = 'approved'
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
  ), false);
$$;
REVOKE ALL ON FUNCTION public.is_account_approved() FROM PUBLIC;
-- Anonymous callers receive only false (auth.uid() is NULL); this grant is needed
-- because the public coach view references the helper even for its anonymous branch.
GRANT EXECUTE ON FUNCTION public.is_account_approved() TO anon, authenticated, service_role;

-- Role-gated policies/functions are unavailable to pending callers. Approved users
-- may inspect their own roles; only public, approved coach status is observable for
-- another user. Staff and service-role operations retain their required checks.
CREATE OR REPLACE FUNCTION public.has_role(p_user uuid, p_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role' THEN EXISTS (
      SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role = p_role
    )
    WHEN NOT public.is_account_approved() THEN false
    WHEN p_user = auth.uid() THEN EXISTS (
      SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role = p_role
    )
    WHEN p_role = 'coach' THEN EXISTS (
      SELECT 1 FROM public.user_roles r
      JOIN public.profiles p ON p.user_id = r.user_id
      WHERE r.user_id = p_user AND r.role = 'coach'
        AND p.account_status = 'approved' AND p.visibility = 'public'
    )
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles staff
      WHERE staff.user_id = auth.uid() AND staff.role IN ('moderator','manager')
    ) AND EXISTS (
      SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role = p_role
    )
  END;
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Use invoker RLS for the public directory. Role records are not visible to every
-- signed-in account: self/staff plus the public coach badge are the only exceptions.
DROP POLICY IF EXISTS "Coach pages public" ON public.coach_profiles;
DROP POLICY IF EXISTS "Signed-in coach profile access" ON public.coach_profiles;
DROP POLICY IF EXISTS "Approved public coach pages" ON public.coach_profiles;
CREATE POLICY "Approved public coach pages"
ON public.coach_profiles FOR SELECT TO anon, authenticated
USING (
  user_id = auth.uid()
  OR public.is_staff()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles r ON r.user_id = p.user_id
    WHERE p.user_id = coach_profiles.user_id AND r.role = 'coach'
      AND p.account_status = 'approved' AND p.visibility = 'public'
  )
);
GRANT SELECT ON public.coach_profiles TO anon, authenticated;

DROP POLICY IF EXISTS "Roles visible to signed in users" ON public.user_roles;
DROP POLICY IF EXISTS "Public approved coach role badges" ON public.user_roles;
CREATE POLICY "Public approved coach role badges"
ON public.user_roles FOR SELECT TO anon
USING (
  role = 'coach' AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = user_roles.user_id
      AND p.account_status = 'approved' AND p.visibility = 'public'
  )
);
DROP POLICY IF EXISTS "Users read own roles or public coach badges" ON public.user_roles;
CREATE POLICY "Users read own roles or public coach badges"
ON public.user_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR public.is_staff()
  OR (role = 'coach' AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = user_roles.user_id
      AND p.account_status = 'approved' AND p.visibility = 'public'
  ))
);
GRANT SELECT ON public.user_roles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_staff(p_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user IS DISTINCT FROM auth.uid() THEN RETURN false; END IF;
  RETURN public.has_role(p_user, 'moderator') OR public.has_role(p_user, 'manager');
END;
$$;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO anon, authenticated, service_role;

-- New users (email or a future OAuth provider) always start pending; provider metadata
-- can populate display fields but can never set account status or roles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  metadata jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  profile_name text;
  profile_photo text;
BEGIN
  profile_name := COALESCE(
    NULLIF(BTRIM(metadata->>'display_name'), ''),
    NULLIF(BTRIM(metadata->>'full_name'), ''),
    NULLIF(BTRIM(metadata->>'name'), ''),
    NULLIF(BTRIM(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1)), ''),
    'عضو جديد'
  );
  profile_name := LEFT(profile_name, 100);
  profile_photo := COALESCE(
    NULLIF(BTRIM(metadata->>'avatar_url'), ''),
    NULLIF(BTRIM(metadata->>'picture'), '')
  );
  IF profile_photo IS NOT NULL AND (LENGTH(profile_photo) > 2048 OR profile_photo !~ '^https://') THEN
    profile_photo := NULL;
  END IF;

  INSERT INTO public.profiles(user_id, display_name, photo_url, account_status)
  VALUES (NEW.id, profile_name, profile_photo, 'pending')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles(user_id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Users may read only their own pending status. Approved callers may read approved
-- public profiles; pending profiles are never exposed through direct table access.
DROP POLICY IF EXISTS "Public or signed-in profile read" ON public.profiles;
DROP POLICY IF EXISTS "Signed-in users read permitted profiles" ON public.profiles;
CREATE POLICY "Approved users read approved profiles or own status"
ON public.profiles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (
    public.is_account_approved()
    AND account_status = 'approved'
    AND (visibility = 'public' OR public.is_staff())
  )
);
DROP POLICY IF EXISTS "Anonymous reads approved public profiles" ON public.profiles;
CREATE POLICY "Anonymous reads approved public profiles"
ON public.profiles FOR SELECT TO anon
USING (account_status = 'approved' AND visibility = 'public');
DROP POLICY IF EXISTS "Pending users may read only own profile" ON public.profiles;
CREATE POLICY "Pending users may read only own profile"
ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_account_approved() OR user_id = auth.uid());
DROP POLICY IF EXISTS "Approved accounts only may edit profiles" ON public.profiles;
CREATE POLICY "Approved accounts only may edit profiles"
ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.is_account_approved())
WITH CHECK (public.is_account_approved());

-- The manager-only RPC is the sole client-facing path that changes review fields.
CREATE OR REPLACE FUNCTION public.guard_account_approval_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() = 'service_role'
     OR current_setting('saytara.account_approval_rpc', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.account_reviewed_at IS DISTINCT FROM OLD.account_reviewed_at
     OR NEW.account_reviewed_by IS DISTINCT FROM OLD.account_reviewed_by
     OR NEW.account_review_reason IS DISTINCT FROM OLD.account_review_reason THEN
    RAISE EXCEPTION 'Only the manager account-review function may change account approval fields.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_account_approval_guard ON public.profiles;
CREATE TRIGGER profiles_account_approval_guard
BEFORE UPDATE OF account_status, account_reviewed_at, account_reviewed_by, account_review_reason
ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.guard_account_approval_fields();

CREATE OR REPLACE FUNCTION public.list_pending_account_reviews()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  profession text,
  specialty text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_account_approved() OR NOT public.has_role(auth.uid(), 'manager') THEN
    RAISE EXCEPTION 'Manager access required';
  END IF;
  RETURN QUERY
    SELECT p.user_id, u.email::text, p.display_name, p.profession, p.specialty, p.created_at
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.account_status = 'pending'
      AND u.email_confirmed_at IS NOT NULL
    ORDER BY p.created_at ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.list_pending_account_reviews() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_account_reviews() TO authenticated;

CREATE OR REPLACE FUNCTION public.review_account_application(
  p_user_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reviewed_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_account_approved() OR NOT public.has_role(auth.uid(), 'manager') THEN
    RAISE EXCEPTION 'Manager access required';
  END IF;
  IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'A manager cannot review their own account';
  END IF;
  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Unsupported account decision';
  END IF;
  IF p_decision = 'rejected' AND COALESCE(NULLIF(BTRIM(p_reason), ''), '') = '' THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;
  IF LENGTH(COALESCE(p_reason, '')) > 1200 THEN
    RAISE EXCEPTION 'Review reason is too long';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = p_user_id AND u.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'The account must confirm its email before review';
  END IF;

  PERFORM set_config('saytara.account_approval_rpc', 'on', true);
  UPDATE public.profiles
     SET account_status = p_decision,
         account_reviewed_at = clock_timestamp(),
         account_reviewed_by = auth.uid(),
         account_review_reason = NULLIF(BTRIM(p_reason), '')
   WHERE user_id = p_user_id AND account_status = 'pending'
   RETURNING * INTO reviewed_profile;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending account not found or already reviewed';
  END IF;

  INSERT INTO public.moderation_actions(moderator_id, subject_user_id, target_type, target_id, action, reason)
  VALUES (
    auth.uid(), reviewed_profile.user_id, 'account', reviewed_profile.user_id,
    'account_decision',
    LEFT(p_decision || CASE WHEN NULLIF(BTRIM(p_reason), '') IS NULL THEN '' ELSE ': ' || BTRIM(p_reason) END, 1500)
  );

  PERFORM set_config('saytara.account_approval_rpc', 'off', true);

  RETURN jsonb_build_object(
    'user_id', reviewed_profile.user_id,
    'account_status', reviewed_profile.account_status,
    'reviewed_at', reviewed_profile.account_reviewed_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.review_account_application(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_account_application(uuid, text, text) TO authenticated;

-- These SECURITY DEFINER functions are trigger/event-trigger entry points, not RPCs.
-- Revoke their default PUBLIC EXECUTE grants so anon/authenticated cannot call them directly.
REVOKE ALL ON FUNCTION public.enforce_message_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_post_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_article_publication() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_booking_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_booking_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_coach_availability_overlap() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_connection_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_content_moderation_state() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_message_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_notification_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_report_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_verification_document_path() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_verified_document_removal() FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.sync_coach_availability() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_account_approval_fields() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.set_updated_at() SET search_path = '';

-- A restrictive policy is ANDed with each existing permissive policy. Thus all
-- authenticated member actions/data are blocked for pending/rejected accounts,
-- while anonymous public-page reads keep their intended behavior.
DO $$
DECLARE
  target_table text;
  protected_tables text[] := ARRAY[
    'user_roles','verification_requests','posts','comments','post_likes','saved_posts',
    'connections','user_blocks','conversations','messages','notifications','groups',
    'group_memberships','events','event_rsvps','articles','coach_profiles',
    'coach_availability','coaching_bookings','membership_plans','memberships','reports',
    'moderation_actions','verification_cleanup_queue'
  ];
BEGIN
  FOREACH target_table IN ARRAY protected_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'approved_account_required', target_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_account_approved()) WITH CHECK (public.is_account_approved())',
      'approved_account_required', target_table
    );
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "Approved account required for verification storage" ON storage.objects;
CREATE POLICY "Approved account required for verification storage"
ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING (public.is_account_approved())
WITH CHECK (public.is_account_approved());

-- This directory view runs with caller privileges and relies on the narrow RLS
-- policies above instead of bypassing them as the view owner.
CREATE OR REPLACE VIEW public.public_coaches WITH (security_barrier = true, security_invoker = true) AS
SELECT p.user_id, p.display_name, p.headline, p.profession, p.specialty, p.city, p.photo_url,
       cp.public_bio, cp.coaching_topics, cp.session_minutes, cp.booking_enabled
FROM public.profiles p
JOIN public.coach_profiles cp ON cp.user_id = p.user_id
JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'coach'
WHERE p.visibility = 'public'
  AND p.account_status = 'approved'
  AND (auth.uid() IS NULL OR public.is_account_approved());
GRANT SELECT ON public.public_coaches TO anon, authenticated;

-- ===== Source: supabase/migrations/202610030002_anon_policy_scoping.sql =====
-- Migration 015 — scope anonymous reads without exposing SECURITY DEFINER helpers as RPCs.
-- The signed-in policies retain existing member/staff behavior; public policies expose published/public rows only.

REVOKE ALL ON FUNCTION public.is_account_approved() FROM anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_active_group_member(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_group_owner(uuid) FROM anon;

-- Anonymous readers see published content only; staff-only draft/moderation access stays authenticated.
DROP POLICY IF EXISTS "Published articles public" ON public.articles;
CREATE POLICY "Published articles public"
ON public.articles FOR SELECT TO anon
USING (status = 'published');
DROP POLICY IF EXISTS "Signed-in articles visible" ON public.articles;
CREATE POLICY "Signed-in articles visible"
ON public.articles FOR SELECT TO authenticated
USING (status = 'published' OR author_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "Published events visible" ON public.events;
CREATE POLICY "Published events visible"
ON public.events FOR SELECT TO anon
USING (NOT is_private AND moderation_state = 'visible');
DROP POLICY IF EXISTS "Signed-in events visible" ON public.events;
CREATE POLICY "Signed-in events visible"
ON public.events FOR SELECT TO authenticated
USING ((NOT is_private AND moderation_state = 'visible') OR organizer_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "Public groups or members read" ON public.groups;
CREATE POLICY "Public groups or members read"
ON public.groups FOR SELECT TO anon
USING (is_public AND moderation_state = 'active');
DROP POLICY IF EXISTS "Signed-in users read permitted groups" ON public.groups;
CREATE POLICY "Signed-in users read permitted groups"
ON public.groups FOR SELECT TO authenticated
USING (
  (is_public AND moderation_state = 'active')
  OR owner_id = auth.uid()
  OR public.is_staff()
  OR EXISTS (
    SELECT 1 FROM public.group_memberships gm
    WHERE gm.group_id = groups.id AND gm.user_id = auth.uid() AND gm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Active membership plans public" ON public.membership_plans;
CREATE POLICY "Active membership plans public"
ON public.membership_plans FOR SELECT TO anon
USING (is_active);
DROP POLICY IF EXISTS "Signed-in membership plans visible" ON public.membership_plans;
CREATE POLICY "Signed-in membership plans visible"
ON public.membership_plans FOR SELECT TO authenticated
USING (is_active OR public.is_staff());

DROP POLICY IF EXISTS "Approved public coach pages" ON public.coach_profiles;
DROP POLICY IF EXISTS "Approved public coach pages authenticated" ON public.coach_profiles;
CREATE POLICY "Approved public coach pages"
ON public.coach_profiles FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles r ON r.user_id = p.user_id
    WHERE p.user_id = coach_profiles.user_id AND r.role = 'coach'
      AND p.account_status = 'approved' AND p.visibility = 'public'
  )
);
CREATE POLICY "Approved public coach pages authenticated"
ON public.coach_profiles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_staff()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles r ON r.user_id = p.user_id
    WHERE p.user_id = coach_profiles.user_id AND r.role = 'coach'
      AND p.account_status = 'approved' AND p.visibility = 'public'
  )
);

-- The view is invoker-secured; underlying RLS now decides which public rows are visible.
CREATE OR REPLACE VIEW public.public_coaches WITH (security_barrier = true, security_invoker = true) AS
SELECT p.user_id, p.display_name, p.headline, p.profession, p.specialty, p.city, p.photo_url,
       cp.public_bio, cp.coaching_topics, cp.session_minutes, cp.booking_enabled
FROM public.profiles p
JOIN public.coach_profiles cp ON cp.user_id = p.user_id
JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'coach'
WHERE p.visibility = 'public'
  AND p.account_status = 'approved';
GRANT SELECT ON public.public_coaches TO anon, authenticated;

-- ===== Source: supabase/migrations/202610040001_platform_owner_hierarchy.sql =====
-- Migration 016 — single platform owner above managers.
-- The owner identity is provisioned once by a project operator using bootstrap-initial-owner.sql.
-- Managers cannot mutate user_roles directly; all role changes go through an owner-checked RPC.


CREATE TABLE IF NOT EXISTS public.platform_owner (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton IS TRUE),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  email_snapshot text NOT NULL CHECK (email_snapshot = lower(btrim(email_snapshot))),
  activated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.platform_owner ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_owner FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.platform_owner_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_email text NOT NULL CHECK (char_length(target_email) <= 320),
  action text NOT NULL CONSTRAINT platform_owner_audit_action_check
    CHECK (action IN ('owner_bootstrap','role_granted','role_revoked','setting_changed','account_suspended','account_restored')),
  role public.app_role,
  setting_key text,
  setting_value jsonb,
  reason text NOT NULL DEFAULT '' CHECK (char_length(reason) <= 1000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS platform_owner_audit_created_idx
  ON public.platform_owner_audit(created_at DESC);
ALTER TABLE public.platform_owner_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_owner_audit FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.platform_settings (
  setting_key text PRIMARY KEY CHECK (setting_key IN ('owner_invitations_enabled')),
  value_boolean boolean NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_settings FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO public.platform_settings(setting_key, value_boolean)
VALUES ('owner_invitations_enabled', true)
ON CONFLICT (setting_key) DO NOTHING;

-- Remove the legacy manager-wide write policy and the underlying API mutation grants.
DROP POLICY IF EXISTS "Managers administer roles" ON public.user_roles;
REVOKE ALL ON TABLE public.user_roles FROM anon, authenticated;
GRANT SELECT ON TABLE public.user_roles TO anon, authenticated;

-- Defense in depth: future permissive policies still cannot authorize direct API writes.
DROP POLICY IF EXISTS "API cannot insert role assignments" ON public.user_roles;
CREATE POLICY "API cannot insert role assignments"
  ON public.user_roles AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (false);
DROP POLICY IF EXISTS "API cannot update role assignments" ON public.user_roles;
CREATE POLICY "API cannot update role assignments"
  ON public.user_roles AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "API cannot delete role assignments" ON public.user_roles;
CREATE POLICY "API cannot delete role assignments"
  ON public.user_roles AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (false);

CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_owner po
    JOIN auth.users u ON u.id = po.user_id
    JOIN public.profiles p ON p.user_id = po.user_id
    WHERE po.singleton IS TRUE
      AND po.user_id = auth.uid()
      AND lower(btrim(u.email)) = po.email_snapshot
      AND u.email_confirmed_at IS NOT NULL
      AND p.account_status = 'approved'
  );
$$;
REVOKE ALL ON FUNCTION public.is_platform_owner() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_owner() TO authenticated;

-- Self-only identity check for destructive account workflows; unlike the active-owner
-- predicate it remains true if the owner temporarily loses email confirmation/approval.
CREATE OR REPLACE FUNCTION public.is_platform_owner_identity()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_owner po
    WHERE po.singleton IS TRUE AND po.user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_platform_owner_identity() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_owner_identity() TO authenticated;

-- A verified, approved owner receives manager-level checks implicitly without a manager row.
CREATE OR REPLACE FUNCTION public.has_role(p_user uuid, p_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role' THEN EXISTS (
      SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role = p_role
    )
    WHEN NOT public.is_account_approved() THEN false
    WHEN p_user = auth.uid()
      AND p_role = 'manager'::public.app_role
      AND public.is_platform_owner() THEN true
    WHEN p_user = auth.uid() THEN EXISTS (
      SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role = p_role
    )
    WHEN p_role = 'coach'::public.app_role THEN EXISTS (
      SELECT 1 FROM public.user_roles r
      JOIN public.profiles p ON p.user_id = r.user_id
      WHERE r.user_id = p_user AND r.role = 'coach'::public.app_role
        AND p.account_status = 'approved' AND p.visibility = 'public'
    )
    ELSE (
      public.is_platform_owner()
      OR EXISTS (
        SELECT 1 FROM public.user_roles staff
        WHERE staff.user_id = auth.uid()
          AND staff.role IN ('moderator'::public.app_role,'manager'::public.app_role)
      )
    ) AND EXISTS (
      SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role = p_role
    )
  END;
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_staff(p_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user IS DISTINCT FROM auth.uid() THEN RETURN false; END IF;
  RETURN public.is_platform_owner()
    OR public.has_role(p_user, 'moderator'::public.app_role)
    OR public.has_role(p_user, 'manager'::public.app_role);
END;
$$;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_platform_accounts()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  account_status text,
  email_confirmed boolean,
  is_platform_owner boolean,
  roles public.app_role[],
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;
  RETURN QUERY
    SELECT u.id, u.email::text, p.display_name, p.account_status, (u.email_confirmed_at IS NOT NULL),
           EXISTS (SELECT 1 FROM public.platform_owner po WHERE po.user_id = u.id),
           COALESCE(array_agg(r.role ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL), ARRAY[]::public.app_role[]),
           u.created_at
    FROM auth.users u
    JOIN public.profiles p ON p.user_id = u.id
    LEFT JOIN public.user_roles r ON r.user_id = u.id
    WHERE u.deleted_at IS NULL
    GROUP BY u.id, u.email, p.display_name, p.account_status, u.email_confirmed_at, u.created_at
    ORDER BY u.created_at DESC
    LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.list_platform_accounts() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_platform_accounts() TO authenticated;

CREATE OR REPLACE FUNCTION public.manage_platform_role(
  p_user_id uuid,
  p_role public.app_role,
  p_action text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_changed integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;
  IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'The owner cannot manage their own role assignments';
  END IF;
  IF p_role IS NULL OR p_role NOT IN (
    'verified'::public.app_role, 'coach'::public.app_role,
    'moderator'::public.app_role, 'manager'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Unsupported managed role';
  END IF;
  IF p_action NOT IN ('grant','revoke') THEN
    RAISE EXCEPTION 'Unsupported role action';
  END IF;
  IF COALESCE(NULLIF(btrim(p_reason), ''), '') = '' OR length(p_reason) > 1000 THEN
    RAISE EXCEPTION 'A reason between 1 and 1000 characters is required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.platform_owner po WHERE po.user_id = p_user_id) THEN
    RAISE EXCEPTION 'The platform owner is not managed through application roles';
  END IF;
  SELECT u.email::text INTO v_email
  FROM auth.users u
  JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = p_user_id
    AND u.deleted_at IS NULL
    AND u.email_confirmed_at IS NOT NULL
    AND p.account_status = 'approved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target account must exist, confirm email, and be approved first';
  END IF;

  IF p_action = 'grant' THEN
    INSERT INTO public.user_roles(user_id, role, granted_by)
    VALUES (p_user_id, p_role, auth.uid())
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = p_user_id AND role = p_role;
  END IF;
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  IF v_changed = 0 THEN
    RAISE EXCEPTION 'No role change was made; the assignment may already be in that state';
  END IF;

  INSERT INTO public.platform_owner_audit(actor_id, target_user_id, target_email, action, role, reason)
  VALUES (
    auth.uid(), p_user_id, lower(btrim(v_email)),
    CASE WHEN p_action = 'grant' THEN 'role_granted' ELSE 'role_revoked' END,
    p_role, btrim(p_reason)
  );
  RETURN jsonb_build_object('user_id', p_user_id, 'role', p_role, 'action', p_action, 'changed', true);
END;
$$;
REVOKE ALL ON FUNCTION public.manage_platform_role(uuid, public.app_role, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.manage_platform_role(uuid, public.app_role, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_owner_invitations_enabled()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_enabled boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;
  SELECT s.value_boolean INTO v_enabled
  FROM public.platform_settings s
  WHERE s.setting_key = 'owner_invitations_enabled';
  RETURN COALESCE(v_enabled, false);
END;
$$;
REVOKE ALL ON FUNCTION public.is_owner_invitations_enabled() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_owner_invitations_enabled() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_platform_setting(
  p_key text,
  p_value boolean,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_previous boolean;
  v_owner_email text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;
  IF p_key IS DISTINCT FROM 'owner_invitations_enabled' OR p_value IS NULL THEN
    RAISE EXCEPTION 'Unsupported platform setting';
  END IF;
  IF COALESCE(NULLIF(btrim(p_reason), ''), '') = '' OR length(p_reason) > 1000 THEN
    RAISE EXCEPTION 'A reason between 1 and 1000 characters is required';
  END IF;
  SELECT lower(btrim(u.email)) INTO v_owner_email
  FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owner email must be confirmed'; END IF;
  SELECT s.value_boolean INTO v_previous
  FROM public.platform_settings s
  WHERE s.setting_key = p_key
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Platform setting is not initialized'; END IF;
  IF v_previous = p_value THEN RAISE EXCEPTION 'Setting already has the requested value'; END IF;

  UPDATE public.platform_settings
  SET value_boolean = p_value, updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE setting_key = p_key;
  INSERT INTO public.platform_owner_audit(actor_id, target_email, action, setting_key, setting_value, reason)
  VALUES (auth.uid(), v_owner_email, 'setting_changed', p_key, to_jsonb(p_value), btrim(p_reason));
  RETURN jsonb_build_object('setting_key', p_key, 'value', p_value, 'changed', true);
END;
$$;
REVOKE ALL ON FUNCTION public.set_platform_setting(text, boolean, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_platform_setting(text, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_platform_account_access(
  p_user_id uuid,
  p_action text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_status text;
  v_next_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;
  IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'The owner cannot suspend or restore their own account';
  END IF;
  IF p_action NOT IN ('suspend','restore') THEN
    RAISE EXCEPTION 'Unsupported account access action';
  END IF;
  IF COALESCE(NULLIF(btrim(p_reason), ''), '') = '' OR length(p_reason) > 1000 THEN
    RAISE EXCEPTION 'A reason between 1 and 1000 characters is required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.platform_owner po WHERE po.user_id = p_user_id) THEN
    RAISE EXCEPTION 'The platform owner account cannot be suspended through the app';
  END IF;
  SELECT u.email::text, p.account_status INTO v_email, v_status
  FROM auth.users u
  JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = p_user_id AND u.deleted_at IS NULL AND u.email_confirmed_at IS NOT NULL
  FOR UPDATE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target account must exist and confirm email first'; END IF;
  IF p_action = 'suspend' AND v_status = 'approved' THEN
    v_next_status := 'rejected';
  ELSIF p_action = 'restore' AND v_status = 'rejected' THEN
    v_next_status := 'approved';
  ELSE
    RAISE EXCEPTION 'Only approved accounts can be suspended and only rejected accounts can be restored';
  END IF;

  PERFORM set_config('saytara.account_approval_rpc', 'on', true);
  UPDATE public.profiles
  SET account_status = v_next_status,
      account_reviewed_at = clock_timestamp(),
      account_reviewed_by = auth.uid(),
      account_review_reason = btrim(p_reason)
  WHERE user_id = p_user_id;
  PERFORM set_config('saytara.account_approval_rpc', 'off', true);

  INSERT INTO public.platform_owner_audit(actor_id, target_user_id, target_email, action, reason)
  VALUES (
    auth.uid(), p_user_id, lower(btrim(v_email)),
    CASE WHEN p_action = 'suspend' THEN 'account_suspended' ELSE 'account_restored' END,
    btrim(p_reason)
  );
  RETURN jsonb_build_object('user_id', p_user_id, 'account_status', v_next_status, 'action', p_action);
END;
$$;
REVOKE ALL ON FUNCTION public.set_platform_account_access(uuid, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_platform_account_access(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_platform_owner_audit(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id bigint,
  actor_id uuid,
  target_user_id uuid,
  target_email text,
  action text,
  role public.app_role,
  setting_key text,
  setting_value jsonb,
  reason text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;
  RETURN QUERY
    SELECT a.id, a.actor_id, a.target_user_id, a.target_email, a.action, a.role,
           a.setting_key, a.setting_value, a.reason, a.created_at
    FROM public.platform_owner_audit a
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
END;
$$;
REVOKE ALL ON FUNCTION public.list_platform_owner_audit(integer) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_platform_owner_audit(integer) TO authenticated;

-- Keep account-review operations available to the owner via the has_role('manager') compatibility check.
-- Managers can review accounts but cannot assign roles or read the owner audit table.


COMMIT;


-- ===== Source: supabase/migrations/20261004020648_learning_center_20261004.sql =====
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
