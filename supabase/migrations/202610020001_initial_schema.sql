-- مجتمع السيطرة — Supabase / PostgreSQL initial schema
-- Apply via Supabase SQL Editor or `supabase db push`. Never put service_role in browser code.
begin;
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
create policy "Owner uploads own verification document" on storage.objects for insert to authenticated with check (bucket_id='verification-private' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Pending owner or staff reads verification document" on storage.objects for select to authenticated using (
 bucket_id='verification-private' and (
   public.is_staff() or ((storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.verification_requests v where v.user_id=auth.uid() and v.document_path=name and v.status in ('pending','more_information')))
 ));
create policy "Owner or staff removes own pending document" on storage.objects for delete to authenticated using (bucket_id='verification-private' and (public.is_staff() or ((storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.verification_requests v where v.user_id=auth.uid() and v.document_path=name and v.status in ('pending','more_information')))));

commit;
