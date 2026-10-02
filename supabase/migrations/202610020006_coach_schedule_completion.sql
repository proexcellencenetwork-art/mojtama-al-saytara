-- Final least-privilege and coaching-schedule lifecycle fixes.
begin;

-- The helper is intentionally callable only by the two Supabase API roles used in policies.
revoke all on function public.is_staff(uuid) from public;
grant execute on function public.is_staff(uuid) to anon,authenticated;

-- Prevent two availability records for one coach from overlapping in time.
create or replace function public.guard_coach_availability_overlap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('saytara-availability:'||new.coach_id::text,0));
  if exists (
    select 1 from public.coach_availability a
    where a.coach_id=new.coach_id and a.id is distinct from new.id
      and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')
  ) then raise exception 'Coach availability slots may not overlap.'; end if;
  return new;
end $$;
drop trigger if exists coach_availability_overlap_guard on public.coach_availability;
create trigger coach_availability_overlap_guard before insert or update on public.coach_availability
for each row execute procedure public.guard_coach_availability_overlap();

-- The dev seed is safely re-runnable: an existing fixture booking is a no-op before slot validation.
create or replace function public.guard_booking_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare slot public.coach_availability; coach public.coach_profiles;
begin
  if auth.role()='service_role' then return new; end if;
  if exists(select 1 from public.coaching_bookings b where b.id=new.id) then return null; end if;
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

-- Coaches may mark an accepted booking completed only after the scheduled session window.
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
  if auth.uid()=old.coach_id and old.status='accepted' and new.status='completed'
     and now() >= old.starts_at + make_interval(mins => old.minutes) then return new; end if;
  if auth.uid()=old.member_id and old.status in ('requested','accepted') and new.status='cancelled' then return new; end if;
  raise exception 'Only the coach can accept, decline, or complete after the session; the member can cancel.';
end $$;

commit;
