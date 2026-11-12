create or replace function public.get_owner_crm_export()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_export jsonb;
begin
  if auth.uid() is null or not public.is_platform_owner() then
    raise exception using errcode = '42501', message = 'Owner access required';
  end if;

  select jsonb_build_object(
    'manifest', jsonb_build_object(
      'project', 'Mojtama Al-Saytara',
      'format_version', 1,
      'exported_at', statement_timestamp(),
      'note', 'CRM and community operations export. Private messages and exact location data are excluded.'
    ),
    'counts', jsonb_build_object(
      'leads', (select count(*) from public.onboarding_leads),
      'lead_interests', (select count(*) from public.onboarding_interest_events),
      'site_events', (select count(*) from public.site_analytics_events),
      'newsletter_subscribers', (select count(*) from public.newsletter_subscribers),
      'member_profiles', (select count(*) from public.profiles),
      'memberships', (select count(*) from public.memberships),
      'user_roles', (select count(*) from public.user_roles),
      'visitor_surveys', (select count(*) from public.public_experience_surveys),
      'member_feedback', (select count(*) from public.community_feedback)
    ),
    'leads', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.created_at desc)
      from public.onboarding_leads l
    ), '[]'::jsonb),
    'lead_interests', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.created_at desc)
      from public.onboarding_interest_events i
    ), '[]'::jsonb),
    'site_events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at desc, e.id desc)
      from public.site_analytics_events e
    ), '[]'::jsonb),
    'newsletter_subscribers', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.created_at desc)
      from public.newsletter_subscribers n
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', p.user_id,
          'email', u.email,
          'display_name', p.display_name,
          'username', p.username,
          'headline', p.headline,
          'profession', p.profession,
          'specialty', p.specialty,
          'workplace', p.workplace,
          'bio', p.bio,
          'photo_url', p.photo_url,
          'experience_years', p.experience_years,
          'interests', p.interests,
          'goals', p.goals,
          'city', p.city,
          'visibility', p.visibility,
          'account_status', p.account_status,
          'created_at', p.created_at,
          'updated_at', p.updated_at
        ) order by p.created_at desc
      )
      from public.profiles p
      left join auth.users u on u.id = p.user_id
    ), '[]'::jsonb),
    'memberships', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'user_id', m.user_id,
          'plan_id', m.plan_id,
          'status', m.status,
          'provider', m.provider,
          'starts_at', m.starts_at,
          'ends_at', m.ends_at,
          'created_at', m.created_at
        ) order by m.created_at desc
      )
      from public.memberships m
    ), '[]'::jsonb),
    'roles', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.granted_at desc)
      from public.user_roles r
    ), '[]'::jsonb),
    'visitor_surveys', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.created_at desc)
      from public.public_experience_surveys s
    ), '[]'::jsonb),
    'member_feedback', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.updated_at desc)
      from public.community_feedback f
    ), '[]'::jsonb)
  )
  into v_export;

  return v_export;
end;
$$;

revoke all on function public.get_owner_crm_export() from public;
grant execute on function public.get_owner_crm_export() to authenticated;
