begin;

create table if not exists public.site_analytics_events (
 id bigint generated always as identity primary key,
 event_name text not null check(event_name in ('page_view','tool_start','tool_complete','register_view','workshop_view','cta_click')),
 page_path text not null check(char_length(page_path) between 1 and 300 and left(page_path,1)='/'),
 event_label text check(event_label is null or char_length(event_label)<=160),
 visitor_id uuid not null,
 user_id uuid references auth.users(id) on delete set null,
 referrer_host text check(referrer_host is null or char_length(referrer_host)<=160),
 source text check(source is null or char_length(source)<=120),
 medium text check(medium is null or char_length(medium)<=120),
 campaign text check(campaign is null or char_length(campaign)<=160),
 timezone text check(timezone is null or char_length(timezone)<=80),
 locale text check(locale is null or char_length(locale)<=24),
 device_category text check(device_category is null or device_category in ('mobile','tablet','desktop','unknown')),
 created_at timestamptz not null default now()
);
create index if not exists site_analytics_events_created_at_idx on public.site_analytics_events(created_at desc);
create index if not exists site_analytics_events_page_created_idx on public.site_analytics_events(page_path,created_at desc);
create index if not exists site_analytics_events_visitor_created_idx on public.site_analytics_events(visitor_id,created_at desc);
alter table public.site_analytics_events enable row level security;
revoke all on public.site_analytics_events from anon,authenticated;

create table if not exists public.newsletter_subscribers (
 id uuid primary key default gen_random_uuid(),
 email text not null check(char_length(email) between 5 and 320 and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
 status text not null default 'subscribed' check(status in ('subscribed','unsubscribed')),
 consent_at timestamptz not null default now(),
 consent_text text not null default 'أوافق على تلقي تحديثات مجتمع السيطرة المهنية عبر البريد الإلكتروني.',
 source_path text not null default '/' check(char_length(source_path) between 1 and 300 and left(source_path,1)='/'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unsubscribed_at timestamptz
);
create unique index if not exists newsletter_subscribers_email_lower_uidx on public.newsletter_subscribers(lower(email));
create index if not exists newsletter_subscribers_status_created_idx on public.newsletter_subscribers(status,created_at desc);
alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from anon,authenticated;

create or replace function public.record_site_analytics_event(p_event_name text,p_page_path text,p_visitor_id uuid,p_event_label text default null,p_referrer_host text default null,p_source text default null,p_medium text default null,p_campaign text default null,p_timezone text default null,p_locale text default null,p_device_category text default 'unknown')
returns boolean language plpgsql security definer set search_path='' as $$
declare recent_count integer;
begin
 if p_event_name not in ('page_view','tool_start','tool_complete','register_view','workshop_view','cta_click') or p_page_path is null or char_length(p_page_path) not between 1 and 300 or left(p_page_path,1)<>'/' or p_visitor_id is null then return false; end if;
 if p_event_label is not null and char_length(p_event_label)>160 then return false; end if;
 if p_device_category not in ('mobile','tablet','desktop','unknown') then p_device_category:='unknown'; end if;
 select count(*) into recent_count from public.site_analytics_events where visitor_id=p_visitor_id and created_at>now()-interval '1 minute';
 if recent_count>=40 then return false; end if;
 insert into public.site_analytics_events(event_name,page_path,event_label,visitor_id,user_id,referrer_host,source,medium,campaign,timezone,locale,device_category)
 values(p_event_name,left(p_page_path,300),left(nullif(p_event_label,''),160),p_visitor_id,auth.uid(),left(nullif(p_referrer_host,''),160),left(nullif(p_source,''),120),left(nullif(p_medium,''),120),left(nullif(p_campaign,''),160),left(nullif(p_timezone,''),80),left(nullif(p_locale,''),24),p_device_category);
 return true;
end; $$;
revoke all on function public.record_site_analytics_event(text,text,uuid,text,text,text,text,text,text,text,text) from public;
grant execute on function public.record_site_analytics_event(text,text,uuid,text,text,text,text,text,text,text,text) to anon,authenticated;

create or replace function public.request_newsletter_subscription(p_email text,p_source_path text default '/')
returns text language plpgsql security definer set search_path='' as $$
declare clean_email text:=lower(btrim(coalesce(p_email,''))); clean_path text:=coalesce(nullif(left(p_source_path,300),''),'/');
begin
 if char_length(clean_email) not between 5 and 320 or clean_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'أدخل بريدًا إلكترونيًا صالحًا.'; end if;
 if left(clean_path,1)<>'/' then clean_path:='/'; end if;
 insert into public.newsletter_subscribers(email,status,consent_at,source_path,updated_at,unsubscribed_at)
 values(clean_email,'subscribed',now(),clean_path,now(),null)
 on conflict (lower(email)) do update set status='subscribed',consent_at=now(),source_path=excluded.source_path,updated_at=now(),unsubscribed_at=null;
 return 'subscribed';
end; $$;
revoke all on function public.request_newsletter_subscription(text,text) from public;
grant execute on function public.request_newsletter_subscription(text,text) to anon,authenticated;

create or replace function public.get_owner_site_analytics(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare days_back integer:=least(greatest(coalesce(p_days,30),1),90); result jsonb;
begin
 if auth.uid() is null or not public.is_platform_owner() then raise exception 'Owner access required'; end if;
 with filtered as (select * from public.site_analytics_events where created_at>=now()-make_interval(days=>days_back)),
 visitor_scores as (
  select visitor_id,(array_agg(user_id) filter(where user_id is not null))[1] as user_id,
   count(*) filter(where event_name='page_view')::integer as page_views,
   count(*) filter(where event_name='tool_start')::integer as tool_starts,
   count(*) filter(where event_name='tool_complete')::integer as tool_completions,
   count(distinct created_at::date)::integer as active_days,
   (count(*) filter(where event_name='page_view')+count(*) filter(where event_name='tool_start')*3+count(*) filter(where event_name='tool_complete')*6+count(*) filter(where event_name='register_view')*4+count(distinct created_at::date)*2)::integer as interest_score,
   max(created_at) as last_seen
  from filtered group by visitor_id
 ),
 page_stats as (select page_path,count(*) filter(where event_name='page_view')::integer as page_views,count(distinct visitor_id) filter(where event_name='page_view')::integer as visitors from filtered group by page_path),
 tool_stats as (select coalesce(event_label,page_path) as tool,count(*) filter(where event_name='tool_start')::integer as starts,count(*) filter(where event_name='tool_complete')::integer as completions,count(distinct visitor_id) filter(where event_name='tool_start')::integer as users from filtered where event_name in ('tool_start','tool_complete') group by coalesce(event_label,page_path)),
 source_stats as (select coalesce(source,referrer_host,'مباشر أو غير معروف') as source,count(*) filter(where event_name='page_view')::integer as page_views,count(distinct visitor_id) filter(where event_name='page_view')::integer as visitors from filtered group by coalesce(source,referrer_host,'مباشر أو غير معروف')),
 location_stats as (select coalesce(timezone,'غير معروف') as timezone,coalesce(locale,'غير معروف') as locale,count(distinct visitor_id) as visitors from filtered group by coalesce(timezone,'غير معروف'),coalesce(locale,'غير معروف')),
 daily_stats as (select (created_at at time zone 'Asia/Riyadh')::date as day,count(*) filter(where event_name='page_view')::integer as page_views,count(distinct visitor_id) filter(where event_name='page_view')::integer as visitors from filtered group by (created_at at time zone 'Asia/Riyadh')::date),
 interest_rows as (
  select s.visitor_id,s.interest_score,s.page_views,s.tool_starts,s.tool_completions,s.active_days,s.last_seen,
   coalesce(p.display_name,case when s.user_id is not null then split_part(u.email,'@',1) else 'زائر مجهول' end) as display_name,
   case when s.user_id is not null then u.email else null end as email,s.user_id
  from visitor_scores s left join auth.users u on u.id=s.user_id left join public.profiles p on p.user_id=s.user_id where s.interest_score>=4
 )
 select jsonb_build_object(
  'days',days_back,
  'overview',jsonb_build_object('page_views',(select count(*) from filtered where event_name='page_view'),'unique_visitors',(select count(distinct visitor_id) from filtered where event_name='page_view'),'tool_starts',(select count(*) from filtered where event_name='tool_start'),'tool_completions',(select count(*) from filtered where event_name='tool_complete'),'newsletter_subscribers',(select count(*) from public.newsletter_subscribers where status='subscribed'),'newsletter_new',(select count(*) from public.newsletter_subscribers where status='subscribed' and created_at>=now()-make_interval(days=>days_back)),'interest_visitors',(select count(*) from interest_rows)),
  'pages',coalesce((select jsonb_agg(to_jsonb(q) order by q.page_views desc) from(select * from page_stats order by page_views desc limit 40)q),'[]'::jsonb),
  'tools',coalesce((select jsonb_agg(to_jsonb(q) order by q.starts desc) from(select * from tool_stats order by starts desc limit 30)q),'[]'::jsonb),
  'sources',coalesce((select jsonb_agg(to_jsonb(q) order by q.page_views desc) from(select * from source_stats order by page_views desc limit 20)q),'[]'::jsonb),
  'locations',coalesce((select jsonb_agg(to_jsonb(q) order by q.visitors desc) from(select * from location_stats order by visitors desc limit 20)q),'[]'::jsonb),
  'daily',coalesce((select jsonb_agg(to_jsonb(q) order by q.day asc) from(select * from daily_stats order by day asc)q),'[]'::jsonb),
  'interested',coalesce((select jsonb_agg(to_jsonb(q) order by q.interest_score desc,q.last_seen desc) from(select * from interest_rows order by interest_score desc,last_seen desc limit 30)q),'[]'::jsonb),
  'subscribers',coalesce((select jsonb_agg(jsonb_build_object('email',email,'status',status,'source_path',source_path,'created_at',created_at,'consent_at',consent_at) order by created_at desc) from(select email,status,source_path,created_at,consent_at from public.newsletter_subscribers order by created_at desc limit 200)q),'[]'::jsonb)
 ) into result;
 return result;
end; $$;
revoke all on function public.get_owner_site_analytics(integer) from public;
grant execute on function public.get_owner_site_analytics(integer) to authenticated;

commit;
