begin;

alter table public.site_analytics_events
  add column if not exists os_family text,
  add column if not exists browser_family text,
  add column if not exists viewport_class text;

alter table public.onboarding_leads
  add column if not exists visitor_id uuid,
  add column if not exists source_referrer text,
  add column if not exists source_campaign text;

create index if not exists site_analytics_device_created_idx
  on public.site_analytics_events (created_at desc, device_category, os_family, browser_family);
create index if not exists onboarding_leads_visitor_id_idx
  on public.onboarding_leads (visitor_id) where visitor_id is not null;

create or replace function public.record_site_analytics_event_v2(
  p_event_name text,p_page_path text,p_visitor_id uuid,p_event_label text default null,
  p_referrer_host text default null,p_source text default null,p_medium text default null,
  p_campaign text default null,p_timezone text default null,p_locale text default null,
  p_device_category text default 'unknown',p_os_family text default null,
  p_browser_family text default null,p_viewport_class text default null
) returns boolean language plpgsql security definer set search_path='' as $$
declare recent_count integer;
begin
  if p_event_name not in ('page_view','tool_start','tool_complete','register_view','workshop_view','cta_click','hero_primary_cta_click','waitlist_submit','career_path_click','coaching_click','membership_view','event_view')
    or p_page_path is null or char_length(p_page_path) not between 1 and 300 or left(p_page_path,1)<>'/' or p_visitor_id is null then return false; end if;
  if p_event_label is not null and char_length(p_event_label)>160 then return false; end if;
  if p_device_category not in ('mobile','tablet','desktop','unknown') then p_device_category:='unknown'; end if;
  if p_os_family not in ('iOS','Android','Windows','macOS','Linux','ChromeOS','Other') then p_os_family:=null; end if;
  if p_browser_family not in ('Chrome','Safari','Firefox','Edge','Samsung Internet','Opera','Other') then p_browser_family:=null; end if;
  if p_viewport_class not in ('compact','medium','wide','unknown') then p_viewport_class:='unknown'; end if;
  select count(*) into recent_count from public.site_analytics_events where visitor_id=p_visitor_id and created_at>now()-interval '1 minute';
  if recent_count>=40 then return false; end if;
  insert into public.site_analytics_events(event_name,page_path,event_label,visitor_id,user_id,referrer_host,source,medium,campaign,timezone,locale,device_category,os_family,browser_family,viewport_class)
  values(p_event_name,left(p_page_path,300),left(nullif(p_event_label,''),160),p_visitor_id,auth.uid(),left(nullif(p_referrer_host,''),160),left(nullif(p_source,''),120),left(nullif(p_medium,''),120),left(nullif(p_campaign,''),160),left(nullif(p_timezone,''),80),left(nullif(p_locale,''),24),p_device_category,p_os_family,p_browser_family,p_viewport_class);
  return true;
end; $$;
revoke all on function public.record_site_analytics_event_v2(text,text,uuid,text,text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.record_site_analytics_event_v2(text,text,uuid,text,text,text,text,text,text,text,text,text,text,text) to anon,authenticated;

create or replace function public.get_owner_device_analytics(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare days_back integer := least(greatest(coalesce(p_days,30),1),90); result jsonb;
begin
  if auth.uid() is null or not public.is_platform_owner() then raise exception 'Owner access required'; end if;
  select jsonb_build_object(
    'devices',coalesce((select jsonb_agg(to_jsonb(q) order by q.visitors desc) from (select coalesce(device_category,'unknown') as device,count(distinct visitor_id)::integer as visitors,count(*) filter(where event_name='page_view')::integer as page_views from public.site_analytics_events where created_at>=now()-make_interval(days=>days_back) group by coalesce(device_category,'unknown')) q),'[]'::jsonb),
    'operating_systems',coalesce((select jsonb_agg(to_jsonb(q) order by q.visitors desc) from (select coalesce(os_family,'غير معروف') as name,count(distinct visitor_id)::integer as visitors from public.site_analytics_events where created_at>=now()-make_interval(days=>days_back) group by coalesce(os_family,'غير معروف')) q),'[]'::jsonb),
    'browsers',coalesce((select jsonb_agg(to_jsonb(q) order by q.visitors desc) from (select coalesce(browser_family,'غير معروف') as name,count(distinct visitor_id)::integer as visitors from public.site_analytics_events where created_at>=now()-make_interval(days=>days_back) group by coalesce(browser_family,'غير معروف')) q),'[]'::jsonb),
    'viewports',coalesce((select jsonb_agg(to_jsonb(q) order by q.visitors desc) from (select coalesce(viewport_class,'unknown') as name,count(distinct visitor_id)::integer as visitors from public.site_analytics_events where created_at>=now()-make_interval(days=>days_back) group by coalesce(viewport_class,'unknown')) q),'[]'::jsonb)
  ) into result;
  return result;
end; $$;
revoke all on function public.get_owner_device_analytics(integer) from public;
grant execute on function public.get_owner_device_analytics(integer) to authenticated;

create or replace function public.get_owner_lead_pipeline(p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_platform_owner() then raise exception 'Owner access required'; end if;
  select jsonb_build_object(
    'total',(select count(*) from public.onboarding_leads),
    'new_count',(select count(*) from public.onboarding_leads where status='new'),
    'contacted_count',(select count(*) from public.onboarding_leads where status='contacted'),
    'qualified_count',(select count(*) from public.onboarding_leads where status='qualified'),
    'converted_count',(select count(*) from public.onboarding_leads where converted_user_id is not null),
    'leads',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from (
      select l.id,l.full_name,l.email,l.user_type,l.specialty,l.goal,l.source_path,l.source_referrer,l.source_campaign,l.status,l.marketing_opt_in,l.created_at,l.updated_at,l.converted_user_id is not null as converted,
      coalesce((select jsonb_agg(jsonb_build_object('interest_key',e.interest_key,'source_page',e.source_page,'created_at',e.created_at) order by e.created_at desc) from public.onboarding_interest_events e where e.lead_id=l.id),'[]'::jsonb) as interests
      from public.onboarding_leads l order by l.created_at desc limit least(greatest(coalesce(p_limit,100),1),250)
    ) q),'[]'::jsonb)
  ) into result;
  return result;
end; $$;
revoke all on function public.get_owner_lead_pipeline(integer) from public;
grant execute on function public.get_owner_lead_pipeline(integer) to authenticated;
