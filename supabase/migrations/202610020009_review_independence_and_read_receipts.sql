-- مجتمع السيطرة — reviewer independence and immutable read receipts.
-- Additive migration; keep the original migration history unchanged.
begin;

create or replace function public.review_verification_request(
  p_request_id uuid,
  p_decision public.review_state,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.verification_requests;
  v_target_user_id uuid;
begin
  if auth.uid() is null or not public.is_staff(auth.uid()) then
    raise exception 'Staff access required';
  end if;
  if p_decision not in ('approved','rejected','more_information') then
    raise exception 'Unsupported verification decision';
  end if;
  if p_decision='rejected' and coalesce(nullif(trim(p_reason),''),'')='' then
    raise exception 'A rejection reason is required';
  end if;

  select user_id into v_target_user_id
  from public.verification_requests
  where id=p_request_id
  for update;
  if not found then raise exception 'Request not found or already finalized'; end if;
  if v_target_user_id=auth.uid() then
    raise exception 'Staff cannot review their own verification request';
  end if;

  update public.verification_requests
     set status=p_decision,
         decision_reason=nullif(trim(p_reason),''),
         reviewer_id=auth.uid(),
         reviewed_at=clock_timestamp()
   where id=p_request_id and status in ('pending','more_information')
   returning * into v_request;
  if not found then raise exception 'Request not found or already finalized'; end if;

  if p_decision='approved' then
    insert into public.user_roles(user_id,role,granted_by)
    values(v_request.user_id,'verified',auth.uid())
    on conflict (user_id,role) do nothing;
  end if;

  insert into public.moderation_actions(moderator_id,subject_user_id,target_type,target_id,action,reason)
  values(auth.uid(),v_request.user_id,'verification_request',v_request.id,'verification_decision',coalesce(p_reason,''));
  return to_jsonb(v_request);
end $$;
revoke all on function public.review_verification_request(uuid,public.review_state,text) from public,anon;
grant execute on function public.review_verification_request(uuid,public.review_state,text) to authenticated;

create or replace function public.guard_message_update() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role()='service_role' or public.is_staff(auth.uid()) then return new; end if;

  if new.id is distinct from old.id
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at
     or new.moderation_state is distinct from old.moderation_state then
    raise exception 'Recipients may only mark their messages as read.';
  end if;

  if auth.uid()=old.recipient_id then
    if old.read_at is null and new.read_at is not null then
      new.read_at := clock_timestamp();
      return new;
    end if;
    if new.read_at is not distinct from old.read_at then return new; end if;
  end if;

  raise exception 'Recipients may only mark their messages as read once.';
end $$;

commit;
