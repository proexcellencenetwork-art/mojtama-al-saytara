-- Final integrity guards for paths, content state, bookings, and participant-controlled mutations.
begin;

-- Verification object names are always exactly <own-user-uuid>/<filename>.
create or replace function public.guard_verification_document_path() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner_id uuid;
begin
  if auth.role()='service_role' then return new; end if;
  owner_id := coalesce(auth.uid(),new.user_id);
  if owner_id is null or new.user_id <> owner_id
     or split_part(new.document_path,'/',1) <> owner_id::text
     or array_length(string_to_array(new.document_path,'/'),1) <> 2
     or split_part(new.document_path,'/',2) = '' then
    raise exception 'Verification files must be stored under the requesting account folder.';
  end if;
  return new;
end $$;
drop trigger if exists verification_document_path_guard on public.verification_requests;
create trigger verification_document_path_guard before insert or update of document_path,user_id on public.verification_requests
for each row execute procedure public.guard_verification_document_path();

drop policy if exists "Owner uploads own verification document" on storage.objects;
create policy "Owner uploads own verification document" on storage.objects for insert to authenticated
with check (bucket_id='verification-private' and (storage.foldername(name))[1]=auth.uid()::text and array_length(storage.foldername(name),1)=1);
drop policy if exists "Pending owner or staff reads verification document" on storage.objects;
create policy "Pending owner or staff reads verification document" on storage.objects for select to authenticated
using (bucket_id='verification-private' and array_length(storage.foldername(name),1)=1 and
 (public.is_staff() or ((storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.verification_requests v where v.user_id=auth.uid() and v.document_path=name and v.status in ('pending','more_information')))));
drop policy if exists "Owner or staff removes own pending document" on storage.objects;
create policy "Owner or staff removes own pending document" on storage.objects for delete to authenticated
using (bucket_id='verification-private' and array_length(storage.foldername(name),1)=1 and
 (public.is_staff() or ((storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.verification_requests v where v.user_id=auth.uid() and v.document_path=name and v.status in ('pending','more_information')))));

-- The anonymous coach directory is only the explicitly whitelisted view; never expose coach_profiles directly.
drop policy if exists "Coach pages public" on public.coach_profiles;
revoke all on public.coach_profiles from anon;
create policy "Signed-in coach profile access" on public.coach_profiles for select to authenticated
using (user_id=auth.uid() or public.is_staff() or (public.has_role(user_id,'coach') and exists(select 1 from public.profiles p where p.user_id=coach_profiles.user_id and p.visibility='public')));

-- Even a row's creator can only read its comment/like while the parent post is visible to them.
drop policy if exists "Visible comments read" on public.comments;
create policy "Visible comments read" on public.comments for select to authenticated
using (public.is_staff() or (moderation_state='visible' and exists(select 1 from public.posts p where p.id=post_id and p.moderation_state='visible')));
drop policy if exists "Members read likes" on public.post_likes;
create policy "Members read likes" on public.post_likes for select to authenticated
using (public.is_staff() or exists(select 1 from public.posts p where p.id=post_id and p.moderation_state='visible'));

-- Only organizers can RSVP to a public event; changing an RSVP cannot bypass the insert rule.
drop policy if exists "Member updates own RSVP" on public.event_rsvps;
create policy "Member updates own RSVP" on public.event_rsvps for update to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid() and exists(select 1 from public.events e where e.id=event_id and not e.is_private and e.moderation_state='visible'));

-- Authors may edit their text, but cannot undo staff moderation or impersonate another author.
create or replace function public.guard_content_moderation_state() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role()='service_role' or public.is_staff(auth.uid()) then return new; end if;
  if new.id is distinct from old.id or to_jsonb(new)->>'author_id' is distinct from to_jsonb(old)->>'author_id'
     or new.created_at is distinct from old.created_at or new.moderation_state is distinct from old.moderation_state then
    raise exception 'Only staff can change content identity or moderation state.';
  end if;
  return new;
end $$;
drop trigger if exists posts_moderation_guard on public.posts;
create trigger posts_moderation_guard before update on public.posts for each row execute procedure public.guard_content_moderation_state();
drop trigger if exists comments_moderation_guard on public.comments;
create trigger comments_moderation_guard before update on public.comments for each row execute procedure public.guard_content_moderation_state();

drop trigger if exists groups_moderation_guard on public.groups;
create trigger groups_moderation_guard before update on public.groups for each row execute procedure public.guard_content_moderation_state();
drop trigger if exists events_moderation_guard on public.events;
create trigger events_moderation_guard before update on public.events for each row execute procedure public.guard_content_moderation_state();
create or replace function public.guard_article_publication() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role()='service_role' or public.is_staff(auth.uid()) then return new; end if;
  if new.id is distinct from old.id or new.author_id is distinct from old.author_id
     or (new.status is distinct from old.status and not (public.has_role(auth.uid(),'verified') or public.has_role(auth.uid(),'coach') or public.has_role(auth.uid(),'manager'))) then
    raise exception 'Only an eligible author or staff may change publication state.';
  end if;
  return new;
end $$;
drop trigger if exists articles_publication_guard on public.articles;
create trigger articles_publication_guard before update on public.articles for each row execute procedure public.guard_article_publication();

-- A recipient may only mark a message read; participants cannot rewrite authorship or the conversation.
create or replace function public.guard_message_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role()='service_role' or public.is_staff(auth.uid()) then return new; end if;
  if auth.uid()=old.recipient_id and new.id=old.id and new.conversation_id=old.conversation_id
     and new.sender_id=old.sender_id and new.recipient_id=old.recipient_id and new.body=old.body
     and new.created_at=old.created_at and new.moderation_state=old.moderation_state and new.read_at is not null then
    return new;
  end if;
  raise exception 'Recipients may only mark their messages as read.';
end $$;
drop trigger if exists messages_update_guard on public.messages;
create trigger messages_update_guard before update on public.messages for each row execute procedure public.guard_message_update();
create or replace function public.guard_notification_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role()='service_role' or public.is_staff(auth.uid()) then return new; end if;
  if auth.uid()=old.recipient_id and new.id=old.id and new.recipient_id=old.recipient_id
     and new.actor_id is not distinct from old.actor_id and new.kind=old.kind
     and new.entity_type is not distinct from old.entity_type and new.entity_id is not distinct from old.entity_id
     and new.body=old.body and new.created_at=old.created_at then return new; end if;
  raise exception 'Recipients may only update notification read state.';
end $$;
drop trigger if exists notifications_update_guard on public.notifications;
create trigger notifications_update_guard before update on public.notifications for each row execute procedure public.guard_notification_update();

-- Coach-only acceptance/decline; members may cancel, but cannot accept their own booking.
create or replace function public.guard_booking_transition() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role()='service_role' or public.is_staff(auth.uid()) then return new; end if;
  if new.id is distinct from old.id or new.coach_id is distinct from old.coach_id
     or new.member_id is distinct from old.member_id or new.created_at is distinct from old.created_at then
    raise exception 'Booking participants and identity are immutable.';
  end if;
  if auth.uid()=old.coach_id and old.status='requested' and new.status in ('accepted','declined') then return new; end if;
  if auth.uid()=old.member_id and old.status in ('requested','accepted') and new.status='cancelled' then return new; end if;
  raise exception 'Only the coach can accept or decline; the member can cancel.';
end $$;
drop trigger if exists coaching_booking_transition_guard on public.coaching_bookings;
create trigger coaching_booking_transition_guard before update on public.coaching_bookings for each row execute procedure public.guard_booking_transition();

commit;
