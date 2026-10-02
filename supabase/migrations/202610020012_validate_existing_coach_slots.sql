-- مجتمع السيطرة — reject legacy rows that violate the protected storage/schedule invariants.
begin;

do $$
declare
  conflict_row record;
begin
  select a.coach_id, a.id as first_slot_id, b.id as second_slot_id
    into conflict_row
  from public.coach_availability a
  join public.coach_availability b
    on b.coach_id=a.coach_id
   and b.id>a.id
   and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')
  limit 1;

  if found then
    raise exception 'Existing overlapping coach availability slots must be reconciled before continuing. coach_id=%, slot_ids=%,%',
      conflict_row.coach_id, conflict_row.first_slot_id, conflict_row.second_slot_id;
  end if;

  select id, user_id, document_path
    into conflict_row
  from public.verification_requests
  where split_part(document_path,'/',1) <> user_id::text
     or array_length(string_to_array(document_path,'/'),1) <> 2
     or split_part(document_path,'/',2) = ''
  limit 1;

  if found then
    raise exception 'Existing verification request has a non-canonical document path. request_id=%, user_id=%, path=%',
      conflict_row.id, conflict_row.user_id, conflict_row.document_path;
  end if;
end $$;

commit;
