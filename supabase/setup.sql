-- مجتمع السيطرة — ملف إعداد موحّد لمشروع Supabase جديد.
-- انسخ الملف كاملاً إلى SQL Editor وشغّله مرة واحدة فقط.
-- يضم migrations 001–009 بترتيبها داخل معاملة واحدة؛ لا يتضمن seed.sql.
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


COMMIT;
