begin;
alter table public.onboarding_leads add column if not exists user_type text not null default 'professional';
alter table public.onboarding_leads drop constraint if exists onboarding_leads_user_type_check;
alter table public.onboarding_leads add constraint onboarding_leads_user_type_check check(user_type in ('professional','job_seeker','graduate','coach','researcher','innovator','other'));
create unique index if not exists onboarding_leads_email_lower_uidx on public.onboarding_leads(lower(email));
alter table public.site_analytics_events drop constraint if exists site_analytics_events_event_name_check;
alter table public.site_analytics_events add constraint site_analytics_events_event_name_check check(event_name in ('page_view','tool_start','tool_complete','register_view','workshop_view','cta_click','hero_primary_cta_click','waitlist_submit','career_path_click','coaching_click','membership_view','event_view'));
create or replace function public.record_site_analytics_event(p_event_name text,p_page_path text,p_visitor_id uuid,p_event_label text default null,p_referrer_host text default null,p_source text default null,p_medium text default null,p_campaign text default null,p_timezone text default null,p_locale text default null,p_device_category text default 'unknown')
returns boolean language plpgsql security definer set search_path='' as $$
declare recent_count integer;
begin
 if p_event_name not in ('page_view','tool_start','tool_complete','register_view','workshop_view','cta_click','hero_primary_cta_click','waitlist_submit','career_path_click','coaching_click','membership_view','event_view') or p_page_path is null or char_length(p_page_path) not between 1 and 300 or left(p_page_path,1)<>'/' or p_visitor_id is null then return false; end if;
 if p_event_label is not null and char_length(p_event_label)>160 then return false; end if;
 if p_device_category not in ('mobile','tablet','desktop','unknown') then p_device_category:='unknown'; end if;
 select count(*) into recent_count from public.site_analytics_events where visitor_id=p_visitor_id and created_at>now()-interval '1 minute';
 if recent_count>=40 then return false; end if;
 insert into public.site_analytics_events(event_name,page_path,event_label,visitor_id,user_id,referrer_host,source,medium,campaign,timezone,locale,device_category) values(p_event_name,left(p_page_path,300),left(nullif(p_event_label,''),160),p_visitor_id,auth.uid(),left(nullif(p_referrer_host,''),160),left(nullif(p_source,''),120),left(nullif(p_medium,''),120),left(nullif(p_campaign,''),160),left(nullif(p_timezone,''),80),left(nullif(p_locale,''),24),p_device_category);
 return true;
end; $$;
revoke all on function public.record_site_analytics_event(text,text,uuid,text,text,text,text,text,text,text,text) from public;
grant execute on function public.record_site_analytics_event(text,text,uuid,text,text,text,text,text,text,text,text) to anon,authenticated;
commit;
