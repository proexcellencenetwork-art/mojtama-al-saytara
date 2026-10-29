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
