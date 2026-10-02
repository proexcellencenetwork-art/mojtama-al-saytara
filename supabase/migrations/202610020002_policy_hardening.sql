-- Security hardening and transition rules for the initial schema.
begin;

-- A pending request can only be accepted/declined by its recipient; requester can cancel only.
create or replace function public.guard_connection_transition() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' or public.is_staff(auth.uid()) then return new; end if;
  if auth.uid() = old.recipient_id and old.status = 'pending'
     and new.status in ('accepted','declined')
     and new.requester_id = old.requester_id and new.recipient_id = old.recipient_id then
    new.responded_at := now(); return new;
  end if;
  if auth.uid() = old.requester_id and old.status = 'pending'
     and new.status = 'declined'
     and new.requester_id = old.requester_id and new.recipient_id = old.recipient_id then
    new.responded_at := now(); return new;
  end if;
  raise exception 'Only the recipient can accept or decline a pending connection; the requester may cancel it.';
end $$;
drop trigger if exists connections_guard_transition on public.connections;
create trigger connections_guard_transition before update on public.connections
for each row execute procedure public.guard_connection_transition();

-- A private group request is pending until its owner/moderator activates it.
drop policy if exists "Members request or join" on public.group_memberships;
create policy "Members request or join" on public.group_memberships for insert to authenticated
with check (
  user_id=auth.uid() and (
    status='pending' or (status='active' and exists(select 1 from public.groups g where g.id=group_id and g.is_public=true))
  )
);
drop policy if exists "Member or group owner updates membership" on public.group_memberships;
create policy "Member or group owner updates membership" on public.group_memberships for update to authenticated
using (user_id=auth.uid() or exists(select 1 from public.groups g where g.id=group_id and g.owner_id=auth.uid()) or public.is_staff())
with check (
  (user_id=auth.uid() and status in ('pending','removed'))
  or exists(select 1 from public.groups g where g.id=group_id and g.owner_id=auth.uid())
  or public.is_staff()
);

-- Respect post visibility at the parent row; comments/likes cannot leak a connection-only post.
drop policy if exists "Members read visible posts" on public.posts;
create policy "Members read visible posts" on public.posts for select to authenticated
using (
  (moderation_state='visible' and (
    author_id=auth.uid() or public.is_staff() or visibility in ('public','members')
    or (visibility='connections' and exists(
      select 1 from public.connections c where c.status='accepted'
      and ((c.requester_id=auth.uid() and c.recipient_id=posts.author_id)
        or (c.requester_id=posts.author_id and c.recipient_id=auth.uid()))
    ))
  )) or author_id=auth.uid() or public.is_staff()
);
drop policy if exists "Visible comments read" on public.comments;
create policy "Visible comments read" on public.comments for select to authenticated
using (
  author_id=auth.uid() or public.is_staff() or (
    moderation_state='visible' and exists(select 1 from public.posts p where p.id=post_id and p.moderation_state='visible')
  )
);
drop policy if exists "Members read likes" on public.post_likes;
create policy "Members read likes" on public.post_likes for select to authenticated
using (
  user_id=auth.uid() or public.is_staff() or exists(select 1 from public.posts p where p.id=post_id and p.moderation_state='visible')
);

-- Staff decisions run through one auditable transaction. Approval grants the verified role.
drop policy if exists "Staff reviews verification" on public.verification_requests;
create or replace function public.review_verification_request(
  p_request_id uuid,
  p_decision public.review_state,
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_request public.verification_requests;
begin
  if auth.uid() is null or not public.is_staff(auth.uid()) then raise exception 'Staff access required'; end if;
  if p_decision not in ('approved','rejected','more_information') then raise exception 'Unsupported verification decision'; end if;
  if p_decision='rejected' and coalesce(nullif(trim(p_reason),''),'')='' then raise exception 'A rejection reason is required'; end if;
  update public.verification_requests
     set status=p_decision, decision_reason=nullif(trim(p_reason),''), reviewer_id=auth.uid(), reviewed_at=now()
   where id=p_request_id and status in ('pending','more_information')
   returning * into v_request;
  if not found then raise exception 'Request not found or already finalized'; end if;
  if p_decision='approved' then
    insert into public.user_roles(user_id,role,granted_by) values(v_request.user_id,'verified',auth.uid())
    on conflict (user_id,role) do nothing;
  end if;
  insert into public.moderation_actions(moderator_id,subject_user_id,target_type,target_id,action,reason)
  values(auth.uid(),v_request.user_id,'verification_request',v_request.id,'verification_decision',coalesce(p_reason,''));
  return to_jsonb(v_request);
end $$;
grant execute on function public.review_verification_request(uuid,public.review_state,text) to authenticated;

-- Queue the previous upload if replaced; queue the final upload on accept/reject, including after more-information.
create or replace function public.queue_verified_document_removal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.document_path is not null and old.document_path is distinct from new.document_path then
    insert into public.verification_cleanup_queue(bucket_id,object_path) values('verification-private',old.document_path);
  elsif old.status in ('pending','more_information') and new.status in ('approved','rejected') and old.document_path is not null then
    insert into public.verification_cleanup_queue(bucket_id,object_path) values('verification-private',old.document_path);
  end if;
  return new;
end $$;
drop trigger if exists verification_file_cleanup_enqueue on public.verification_requests;
create trigger verification_file_cleanup_enqueue after update on public.verification_requests
for each row execute procedure public.queue_verified_document_removal();

-- Enable low-latency Postgres Changes for the signed-in social experience where Supabase's publication exists.
do $$
declare t text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['messages','notifications','posts','connections'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;

commit;
