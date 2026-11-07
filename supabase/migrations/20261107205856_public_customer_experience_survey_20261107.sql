begin;
create table if not exists public.public_experience_surveys (
 visitor_id uuid primary key,
 overall_rating smallint not null check (overall_rating between 1 and 5),
 recommendation_score smallint not null check (recommendation_score between 0 and 10),
 ease_rating smallint not null check (ease_rating between 1 and 5),
 used_area text not null check (used_area in ('articles','tools','videos','community','other','not_used')),
 improvement_area text not null check (improvement_area in ('content','tools','navigation','speed','sign_in','live_sessions','other')),
 comment text not null default '' check (char_length(comment) <= 500),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.public_experience_surveys enable row level security;
revoke all on public.public_experience_surveys from anon, authenticated;
create index if not exists public_experience_surveys_created_idx on public.public_experience_surveys(created_at desc);
create or replace function public.submit_public_experience_survey(p_visitor_id uuid,p_overall_rating integer,p_recommendation_score integer,p_ease_rating integer,p_used_area text,p_improvement_area text,p_comment text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare prior_count integer;
begin
 if p_visitor_id is null or p_overall_rating not between 1 and 5 or p_recommendation_score not between 0 and 10 or p_ease_rating not between 1 and 5
 or p_used_area not in ('articles','tools','videos','community','other','not_used') or p_improvement_area not in ('content','tools','navigation','speed','sign_in','live_sessions','other') or char_length(coalesce(p_comment,''))>500 then raise exception 'Invalid survey response'; end if;
 select count(*) into prior_count from public.public_experience_surveys where visitor_id=p_visitor_id and created_at>now()-interval '1 hour';
 if prior_count>0 then update public.public_experience_surveys set overall_rating=p_overall_rating,recommendation_score=p_recommendation_score,ease_rating=p_ease_rating,used_area=p_used_area,improvement_area=p_improvement_area,comment=coalesce(p_comment,''),updated_at=now() where visitor_id=p_visitor_id;
 else insert into public.public_experience_surveys(visitor_id,overall_rating,recommendation_score,ease_rating,used_area,improvement_area,comment) values(p_visitor_id,p_overall_rating,p_recommendation_score,p_ease_rating,p_used_area,p_improvement_area,coalesce(p_comment,'')) on conflict(visitor_id) do update set overall_rating=excluded.overall_rating,recommendation_score=excluded.recommendation_score,ease_rating=excluded.ease_rating,used_area=excluded.used_area,improvement_area=excluded.improvement_area,comment=excluded.comment,updated_at=now(); end if;
 return jsonb_build_object('saved',true);
end; $$;
revoke all on function public.submit_public_experience_survey(uuid,integer,integer,integer,text,text,text) from public;
grant execute on function public.submit_public_experience_survey(uuid,integer,integer,integer,text,text,text) to anon,authenticated;
create or replace function public.get_owner_public_survey_summary(p_days integer default 90)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; d integer:=least(greatest(coalesce(p_days,90),1),365);
begin
 if auth.uid() is null or not public.is_platform_owner() then raise exception 'Owner access required'; end if;
 select jsonb_build_object(
 'responses',count(*)::integer,'average_rating',round(avg(overall_rating)::numeric,2),'average_recommendation',round(avg(recommendation_score)::numeric,2),'average_ease',round(avg(ease_rating)::numeric,2),
 'areas',coalesce((select jsonb_agg(to_jsonb(x) order by x.responses desc) from (select improvement_area as area,count(*)::integer as responses from public.public_experience_surveys where created_at>=now()-make_interval(days=>d) group by improvement_area) x),'[]'::jsonb),
 'used_areas',coalesce((select jsonb_agg(to_jsonb(x) order by x.responses desc) from (select used_area as area,count(*)::integer as responses from public.public_experience_surveys where created_at>=now()-make_interval(days=>d) group by used_area) x),'[]'::jsonb),
 'recommendation_distribution',coalesce((select jsonb_agg(to_jsonb(x) order by x.score) from (select recommendation_score as score,count(*)::integer as responses from public.public_experience_surveys where created_at>=now()-make_interval(days=>d) group by recommendation_score) x),'[]'::jsonb),
 'recent_comments',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select comment,overall_rating,created_at from public.public_experience_surveys where created_at>=now()-make_interval(days=>d) and comment<>'' order by created_at desc limit 30) x),'[]'::jsonb)
 ) into result from public.public_experience_surveys where created_at>=now()-make_interval(days=>d); return result;
end; $$;
revoke all on function public.get_owner_public_survey_summary(integer) from public;
grant execute on function public.get_owner_public_survey_summary(integer) to authenticated;
commit;