revoke execute on function public.get_owner_behavioral_insights(integer) from anon;
revoke execute on function public.get_owner_device_analytics(integer) from anon;
revoke execute on function public.get_owner_lead_pipeline(integer) from anon;
revoke execute on function public.get_owner_public_survey_summary(integer) from anon;
revoke execute on function public.owner_list_educational_videos() from anon;
revoke execute on function public.owner_upsert_educational_video(uuid,text,text,text,text,text,boolean) from anon;
revoke execute on function public.owner_update_lead_status(uuid,text) from anon;