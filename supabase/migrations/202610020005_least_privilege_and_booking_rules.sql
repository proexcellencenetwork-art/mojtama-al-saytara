-- Least-privilege execution grants and authoritative booking/read-receipt transitions.
begin;

-- has_role remains available to authenticated members for role-aware policies/UI, never to anonymous visitors.
revoke all on function public.has_role(uuid,public.app_role) from public,anon;
grant execute on function public.has_role(uuid,public.app_role) to authenticated;
-- Policies call is_staff() for visitor/public-page filtering, so retain execution but never disclose another user's role.
create or replace function public.is_staff(p_user uuid default auth.uid()) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if p_user is distinct from auth.uid() then return false; end if;
  return public.has_role(p_user,'moderator') or public.has_role(p_user,'manager');
end $$;
grant execute on function public.is_staff(uuid) to anon,authenticated;
revoke all on function public.can_message(uuid,uuid) from public,anon;
grant execute on function public.can_message(uuid,uuid) to authenticated;
create or replace function public.can_message(p_sender uuid,p_recipient uuid) returns boolean
language sql stable security definer set search_path = public as $$
 select auth.uid() is not null and p_sender=auth.uid() and p_sender <> p_recipient
 and not exists(select 1 from public.user_blocks b where (b.blocker_id=p_sender and b.blocked_id=p_recipient) or (b.blocker_id=p_recipient and b.blocked_id=p_sender))
 and (public.has_role(p_sender,'verified') or public.has_role(p_sender,'coach') or public.has_role(p_sender,'moderator') or public.has_role(p_sender,'manager')
   or exists(select 1 from public.connections c where c.status='accepted' and ((c.requester_id=p_sender and c.recipient_id=p_recipient) or (c.requester_id=p_recipient and c.recipient_id=p_sender))));
$$;
revoke all on function public.review_verification_request(uuid,public.review_state,text) from public,anon;
grant execute on function public.review_verification_request(uuid,public.review_state,text) to authenticated;

-- Booking requests must be pending, enabled by the coach, and tied to that coach's valid available slot.
create or replace function public.guard_booking_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare slot public.coach_availability; coach public.coach_profiles;
begin
  if auth.role()='service_role' then return new; end if;
  if new.status <> 'requested' or (auth.uid() is not null and new.member_id <> auth.uid()) then
    raise exception 'Members may only create their own requested bookings.';
  end if;
  select * into coach from public.coach_profiles cp where cp.user_id=new.coach_id and cp.booking_enabled=true;
  if not found or not public.has_role(new.coach_id,'coach') then raise exception 'Coach bookings are not enabled.'; end if;
  if new.availability_id is null then raise exception 'Choose an available coaching slot.'; end if;
  select * into slot from public.coach_availability a where a.id=new.availability_id and a.coach_id=new.coach_id and a.is_available=true for update;
  if not found or slot.starts_at <> new.starts_at or new.minutes <> any(coach.session_minutes)
     or new.minutes*60 > extract(epoch from (slot.ends_at-slot.starts_at)) then
    raise exception 'The selected slot is unavailable or incompatible with the session length.';
  end if;
  return new;
end $$;
drop trigger if exists coaching_booking_insert_guard on public.coaching_bookings;
create trigger coaching_booking_insert_guard before insert on public.coaching_bookings for each row execute procedure public.guard_booking_insert();
create unique index if not exists coaching_bookings_one_active_slot_idx on public.coaching_bookings(availability_id)
where availability_id is not null and status in ('requested','accepted');

create or replace function public.guard_booking_transition() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role()='service_role' or public.is_staff(auth.uid()) then return new; end if;
  if new.id is distinct from old.id or new.coach_id is distinct from old.coach_id
     or new.member_id is distinct from old.member_id or new.created_at is distinct from old.created_at
     or new.availability_id is distinct from old.availability_id or new.starts_at is distinct from old.starts_at
     or new.minutes is distinct from old.minutes or new.member_note is distinct from old.member_note then
    raise exception 'Booking identity and scheduled details are immutable after request.';
  end if;
  if auth.uid()=old.coach_id and old.status='requested' and new.status in ('accepted','declined') then return new; end if;
  if auth.uid()=old.member_id and old.status in ('requested','accepted') and new.status='cancelled' then return new; end if;
  raise exception 'Only the coach can accept or decline; the member can cancel.';
end $$;

-- Hold a selected slot while requested/accepted, and release it after cancellation or decline.
create or replace function public.sync_coach_availability() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op='INSERT' then
    if new.availability_id is not null then update public.coach_availability set is_available=false where id=new.availability_id; end if;
    return new;
  end if;
  if old.availability_id is not null and old.status in ('requested','accepted') and new.status in ('declined','cancelled') then
    update public.coach_availability set is_available=true where id=old.availability_id;
  end if;
  return new;
end $$;
drop trigger if exists coaching_booking_slot_sync on public.coaching_bookings;
create trigger coaching_booking_slot_sync after insert or update of status on public.coaching_bookings
for each row execute procedure public.sync_coach_availability();

-- Read timestamps are set once by the database, not chosen by the recipient.
create or replace function public.guard_message_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role()='service_role' or public.is_staff(auth.uid()) then return new; end if;
  if auth.uid()=old.recipient_id and old.read_at is null and new.id=old.id and new.conversation_id=old.conversation_id
     and new.sender_id=old.sender_id and new.recipient_id=old.recipient_id and new.body=old.body
     and new.created_at=old.created_at and new.moderation_state=old.moderation_state and new.read_at is not null then
    new.read_at := now(); return new;
  end if;
  raise exception 'Recipients may only mark an unread message as read once.';
end $$;

commit;
