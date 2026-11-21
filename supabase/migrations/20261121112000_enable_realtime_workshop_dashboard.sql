alter table public.workshop_submissions alter column outcome_type set default 'improve';
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workshop_submissions'
  ) then
    alter publication supabase_realtime add table public.workshop_submissions;
  end if;
end $$;