begin;

alter table public.site_analytics_events
  drop constraint if exists site_analytics_events_event_name_check;

alter table public.site_analytics_events
  add constraint site_analytics_events_event_name_check
  check (event_name in (
    'page_view','tool_start','tool_complete','tool_intent','register_view',
    'workshop_view','cta_click','hero_primary_cta_click','waitlist_submit',
    'career_path_click','coaching_click','membership_view','event_view'
  ));

create or replace function public.record_site_analytics_event_v2(
  p_event_name text,p_page_path text,p_visitor_id uuid,p_event_label text default null,
  p_referrer_host text default null,p_source text default null,p_medium text default null,
  p_campaign text default null,p_timezone text default null,p_locale text default null,
  p_device_category text default 'unknown',p_os_family text default null,
  p_browser_family text default null,p_viewport_class text default null
) returns boolean language plpgsql security definer set search_path='' as $$
declare recent_count integer;
begin
  if p_event_name not in ('page_view','tool_start','tool_complete','tool_intent','register_view','workshop_view','cta_click','hero_primary_cta_click','waitlist_submit','career_path_click','coaching_click','membership_view','event_view')
    or p_page_path is null or char_length(p_page_path) not between 1 and 300 or left(p_page_path,1)<>'/' or p_visitor_id is null then return false; end if;
  if p_event_label is not null and char_length(p_event_label)>160 then return false; end if;
  if p_event_name='tool_intent' and (
    p_page_path not in ('/career-compass','/linkedin-audit','/fresh-graduate','/value-economy','/achievement-portfolio','/promotion-intelligence','/innovation-rd','/ai-career-leverage','/saudi-labor-market-radar')
    or p_event_label is null
    or p_event_label !~ '^(job|skills|promotion|transition|leadership|explore)\|(professional|job_seeker|graduate|coach|researcher|innovator|other)\|(health_medical|technology_ai|business|engineering|finance|human_resources|education_research|other)$'
  ) then return false; end if;
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

create or replace function public.get_owner_behavioral_insights(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  d integer:=least(greatest(coalesce(p_days,30),1),90);
  result jsonb;
begin
  if auth.uid() is null or not public.is_platform_owner() then raise exception 'Owner access required'; end if;
  select jsonb_build_object(
    'returning_visitors',(select count(*)::integer from (
      select visitor_id from public.site_analytics_events
      where created_at>=now()-make_interval(days=>d) and visitor_id is not null
      group by visitor_id having count(distinct created_at::date)>1
    ) x),
    'repeat_tool_users',(select count(*)::integer from (
      select visitor_id from public.site_analytics_events
      where created_at>=now()-make_interval(days=>d) and event_name='tool_start' and visitor_id is not null
      group by visitor_id having count(*)>1
    ) x),
    'tool_funnels',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.starts desc) from (
        select event_label as tool,
          count(*) filter(where event_name='tool_start')::integer as starts,
          count(*) filter(where event_name='tool_complete')::integer as completions,
          round(100.0*count(*) filter(where event_name='tool_complete')/nullif(count(*) filter(where event_name='tool_start'),0),1) as completion_percent
        from public.site_analytics_events
        where created_at>=now()-make_interval(days=>d) and event_name in ('tool_start','tool_complete')
        group by event_label
      ) x
    ),'[]'::jsonb),
    'tool_intents',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.visitors desc) from (
        select page_path as tool,
          split_part(event_label,'|',1) as goal,
          split_part(event_label,'|',2) as user_type,
          split_part(event_label,'|',3) as specialty,
          count(distinct visitor_id)::integer as visitors
        from public.site_analytics_events
        where created_at>=now()-make_interval(days=>d)
          and event_name='tool_intent'
        group by page_path,split_part(event_label,'|',1),split_part(event_label,'|',2),split_part(event_label,'|',3)
        order by visitors desc limit 30
      ) x
    ),'[]'::jsonb)
  ) into result;
  return result;
end; $$;

revoke all on function public.get_owner_behavioral_insights(integer) from public;
grant execute on function public.get_owner_behavioral_insights(integer) to authenticated;

commit;
