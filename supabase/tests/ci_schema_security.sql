-- Automated, fixture-free pgTAP checks for disposable CI databases.
-- The account-specific *_smoke.sql scripts require pre-created test accounts and are
-- retained for deliberate manual UAT, not run by this self-contained CI suite.
begin;
select plan(33);

select ok(to_regclass('public.profiles') is not null, 'profiles table exists');
select ok(to_regclass('public.posts') is not null, 'posts table exists');
select ok(to_regclass('public.messages') is not null, 'messages table exists');
select ok(to_regclass('public.user_roles') is not null, 'user_roles table exists');
select ok(to_regclass('public.verification_requests') is not null, 'verification_requests table exists');
select ok(to_regclass('public.platform_settings') is not null, 'platform_settings table exists');
select ok(to_regclass('public.platform_owner_audit') is not null, 'platform_owner_audit table exists');
select ok(to_regclass('public.learning_recordings') is not null, 'learning_recordings table exists');
select ok(to_regclass('public.learning_provider_events') is not null, 'learning_provider_events table exists');
select ok(to_regclass('public.articles') is not null, 'articles table exists');

select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.profiles')), false), 'RLS is enabled on profiles');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.posts')), false), 'RLS is enabled on posts');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.messages')), false), 'RLS is enabled on messages');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.user_roles')), false), 'RLS is enabled on user_roles');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.verification_requests')), false), 'RLS is enabled on verification_requests');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.learning_recordings')), false), 'RLS is enabled on learning_recordings');

select ok(not has_table_privilege('authenticated', 'public.user_roles', 'INSERT'), 'authenticated users cannot directly insert role assignments');
select ok(not has_table_privilege('authenticated', 'public.user_roles', 'UPDATE'), 'authenticated users cannot directly update role assignments');
select ok(not has_table_privilege('authenticated', 'public.user_roles', 'DELETE'), 'authenticated users cannot directly delete role assignments');
select ok(not has_table_privilege('authenticated', 'public.platform_settings', 'SELECT'), 'authenticated users cannot directly read platform settings');
select ok(not has_table_privilege('authenticated', 'public.platform_owner_audit', 'SELECT'), 'authenticated users cannot directly read owner audit data');

select ok(not has_function_privilege('anon', 'public.is_staff(uuid)', 'EXECUTE'), 'anonymous users cannot execute internal staff lookup');
select ok(not has_function_privilege('anon', 'public.is_account_approved()', 'EXECUTE'), 'anonymous users cannot execute approval helper');
select ok(not has_function_privilege('authenticated', 'public.guard_message_update()', 'EXECUTE'), 'authenticated users cannot directly execute trigger-only message guard');

-- The public aggregate endpoint must respect the owner's visibility switch.
UPDATE public.platform_settings
SET value_boolean = false
WHERE setting_key = 'public_member_metric_visible';

select ok(
  (public.get_public_community_metric() ->> 'visible')::boolean = false
  AND public.get_public_community_metric() -> 'actual_count' = 'null'::jsonb,
  'public member count is not returned while the owner hides the metric'
);


-- Self-contained professional portfolio RLS regression test.
-- Uses synthetic Auth users and a transaction rollback; never requires live member accounts.
select ok(to_regclass('public.professional_portfolio_items') is not null, 'professional portfolio table exists');
select ok(to_regprocedure('public.get_owner_professional_portfolio_summary()') is not null, 'owner portfolio aggregate function exists');
select ok(not has_function_privilege('anon', 'public.get_owner_professional_portfolio_summary()', 'EXECUTE'), 'anonymous visitors cannot execute owner portfolio aggregate');
select ok(has_function_privilege('authenticated', 'public.get_owner_professional_portfolio_summary()', 'EXECUTE'), 'authenticated callers reach the owner-checked portfolio aggregate');
select ok(
  coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.professional_portfolio_items')), false),
  'RLS is enabled on professional portfolio records'
);

insert into auth.users(id, email, raw_user_meta_data, email_confirmed_at) values
  ('20000000-0000-4000-8000-000000000031', 'portfolio-ci-a@example.test', '{"name":"Portfolio CI A"}'::jsonb, now()),
  ('20000000-0000-4000-8000-000000000032', 'portfolio-ci-b@example.test', '{"name":"Portfolio CI B"}'::jsonb, now()),
  ('20000000-0000-4000-8000-000000000033', 'portfolio-ci-pending@example.test', '{"name":"Portfolio CI pending"}'::jsonb, NULL);

-- The auth trigger creates pending profiles. Approve only the two synthetic test owners
-- through the same guarded test-only transaction setting used by the account approval tests.
select set_config('saytara.account_approval_rpc', 'on', true);
update public.profiles
set account_status = 'approved', visibility = 'public'
where user_id in (
  '20000000-0000-4000-8000-000000000031',
  '20000000-0000-4000-8000-000000000032'
);
select set_config('saytara.account_approval_rpc', 'off', true);

insert into public.professional_portfolio_items(id, user_id, item_type, title, description, visibility) values
  ('30000000-0000-4000-8000-000000000031', '20000000-0000-4000-8000-000000000031', 'project', 'Public project A', 'Public project description', 'public'),
  ('30000000-0000-4000-8000-000000000032', '20000000-0000-4000-8000-000000000031', 'solved_problem', 'Private problem A', 'Private problem description', 'private'),
  ('30000000-0000-4000-8000-000000000033', '20000000-0000-4000-8000-000000000032', 'skill', 'Private skill B', 'Private skill description', 'private'),
  ('30000000-0000-4000-8000-000000000034', '20000000-0000-4000-8000-000000000033', 'result', 'Pending profile result', 'Must not be publicly exposed', 'public');

set local role authenticated;
do $portfolio_ci$
declare
  v_a constant uuid := '20000000-0000-4000-8000-000000000031';
  v_b constant uuid := '20000000-0000-4000-8000-000000000032';
  v_pending constant uuid := '20000000-0000-4000-8000-000000000033';
  v_a_public constant uuid := '30000000-0000-4000-8000-000000000031';
  v_a_private constant uuid := '30000000-0000-4000-8000-000000000032';
  v_b_private constant uuid := '30000000-0000-4000-8000-000000000033';
  v_count integer;
  v_rows integer;
  v_denied boolean;
begin
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a::text, 'role', 'authenticated')::text, true);

  select count(*) into v_count from public.professional_portfolio_items where id = v_a_private;
  if v_count <> 1 then raise exception 'FAIL: owner A cannot read their own private portfolio record'; end if;

  update public.professional_portfolio_items
  set title = 'Private problem A updated by owner'
  where id = v_a_private;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'FAIL: owner A cannot update their own portfolio record'; end if;

  insert into public.professional_portfolio_items(user_id, item_type, title, description)
  values (v_a, 'skill', 'Skill added by owner A', 'A self-owned test record');
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'FAIL: owner A cannot insert their own portfolio record'; end if;

  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_b::text, 'role', 'authenticated')::text, true);

  select count(*) into v_count from public.professional_portfolio_items where id = v_a_private;
  if v_count <> 0 then raise exception 'FAIL: owner B can read owner A private record'; end if;

  select count(*) into v_count from public.professional_portfolio_items where id = v_a_public;
  if v_count <> 1 then raise exception 'FAIL: an approved member cannot read another member public record'; end if;

  update public.professional_portfolio_items set title = 'Unauthorized edit'
  where id = v_a_public;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'FAIL: owner B modified owner A public record'; end if;

  delete from public.professional_portfolio_items where id = v_a_private;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'FAIL: owner B deleted owner A private record'; end if;

  v_denied := false;
  begin
    insert into public.professional_portfolio_items(user_id, item_type, title, description)
    values (v_a, 'skill', 'Impersonated record', 'Owner B must not insert for owner A');
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then raise exception 'FAIL: owner B inserted a record under owner A user_id'; end if;

  delete from public.professional_portfolio_items where id = v_b_private;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'FAIL: owner B cannot delete their own private record'; end if;

  perform set_config('request.jwt.claim.sub', v_pending::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_pending::text, 'role', 'authenticated')::text, true);
  v_denied := false;
  begin
    insert into public.professional_portfolio_items(user_id, item_type, title, description)
    values (v_pending, 'skill', 'Pending member record', 'Pending accounts must not manage portfolio rows');
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then raise exception 'FAIL: an unapproved account managed portfolio records'; end if;

  -- A regular approved member may execute the owner-checked RPC, but must be rejected by its internal owner check.
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_b::text, 'role', 'authenticated')::text, true);
  v_denied := false;
  begin
    perform public.get_owner_professional_portfolio_summary();
  exception when others then
    v_denied := true;
  end;
  if not v_denied then raise exception 'FAIL: a regular member read owner portfolio aggregates'; end if;
end;
$portfolio_ci$;
reset role;
select ok(true, 'approved members can manage only their own portfolio records; public reads do not grant cross-member writes');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $portfolio_ci$
declare
  v_count integer;
begin
  select count(*) into v_count from public.professional_portfolio_items
  where id = '30000000-0000-4000-8000-000000000031';
  if v_count <> 1 then raise exception 'FAIL: anonymous visitor cannot read the explicitly public record of an approved public profile'; end if;

  select count(*) into v_count from public.professional_portfolio_items
  where id = '30000000-0000-4000-8000-000000000032';
  if v_count <> 0 then raise exception 'FAIL: anonymous visitor can read a private portfolio record'; end if;

  select count(*) into v_count from public.professional_portfolio_items
  where id = '30000000-0000-4000-8000-000000000034';
  if v_count <> 0 then raise exception 'FAIL: anonymous visitor can read a portfolio record owned by a pending profile'; end if;
end;
$portfolio_ci$;
reset role;
select ok(true, 'anonymous visitors see only explicit public records from approved public profiles');

update public.profiles
set visibility = 'private'
where user_id = '20000000-0000-4000-8000-000000000031';
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $portfolio_ci$
declare
  v_count integer;
begin
  select count(*) into v_count from public.professional_portfolio_items
  where id = '30000000-0000-4000-8000-000000000031';
  if v_count <> 0 then raise exception 'FAIL: public portfolio record is visible after its owner makes the profile private'; end if;
end;
$portfolio_ci$;
reset role;
select ok(true, 'making the owner profile private hides previously public portfolio records');

select * from finish();
rollback;
