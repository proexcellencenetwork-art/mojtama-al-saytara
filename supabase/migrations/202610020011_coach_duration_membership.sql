-- مجتمع السيطرة — use proper array membership when validating coach session durations.
begin;

create or replace function public.guard_booking_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  slot public.coach_availability;
  coach public.coach_profiles;
begin
  if auth.role()='service_role' then return new; end if;
  if exists(select 1 from public.coaching_bookings b where b.id=new.id) then return null; end if;
  if new.status <> 'requested' or (auth.uid() is not null and new.member_id <> auth.uid()) then
    raise exception 'Members may only create their own requested bookings.';
  end if;
  select * into coach from public.coach_profiles cp where cp.user_id=new.coach_id and cp.booking_enabled=true;
  if not found or not public.has_role(new.coach_id,'coach') then raise exception 'Coach bookings are not enabled.'; end if;
  if new.availability_id is null then raise exception 'Choose an available coaching slot.'; end if;
  select * into slot from public.coach_availability a
  where a.id=new.availability_id and a.coach_id=new.coach_id and a.is_available=true
  for update;
  if not found or slot.starts_at <> new.starts_at
     or not (new.minutes = any(coach.session_minutes))
     or new.minutes*60 > extract(epoch from (slot.ends_at-slot.starts_at)) then
    raise exception 'The selected slot is unavailable or incompatible with the session length.';
  end if;
  return new;
end $$;

commit;
