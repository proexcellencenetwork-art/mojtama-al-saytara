begin;

create table if not exists public.learning_discussion_messages (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.learning_workshops(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists learning_discussion_messages_thread_idx
  on public.learning_discussion_messages (workshop_id, created_at asc, id asc);

alter table public.learning_discussion_messages enable row level security;

revoke all on public.learning_discussion_messages from public, anon, authenticated;
grant select, insert on public.learning_discussion_messages to authenticated;

drop policy if exists learning_discussion_messages_authorized_read
  on public.learning_discussion_messages;
create policy learning_discussion_messages_authorized_read
  on public.learning_discussion_messages
  for select to authenticated
  using (public.can_access_learning_workshop(workshop_id));

drop policy if exists learning_discussion_messages_authorized_insert
  on public.learning_discussion_messages;
create policy learning_discussion_messages_authorized_insert
  on public.learning_discussion_messages
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.can_access_learning_workshop(workshop_id)
    and char_length(btrim(body)) between 1 and 2000
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'learning_discussion_messages'
  ) then
    alter publication supabase_realtime
      add table public.learning_discussion_messages;
  end if;
end
$$;

commit;
