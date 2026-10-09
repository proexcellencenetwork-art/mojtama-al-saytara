-- Automated, fixture-free pgTAP checks for disposable CI databases.
-- The account-specific *_smoke.sql scripts require pre-created test accounts and are
-- retained for deliberate manual UAT, not run by this self-contained CI suite.
begin;
select plan(24);

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

select * from finish();
rollback;
