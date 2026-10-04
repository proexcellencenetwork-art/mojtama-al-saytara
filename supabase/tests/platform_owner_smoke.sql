-- مجتمع السيطرة — اختبار مالك المنصة وهرمية الأدوار.
-- للتجربة المحلية/قاعدة اختبار disposable فقط؛ لا تشغّله على قاعدة الإنتاج.
-- المتطلبات: setup.sql + migration 016 + حسابات اصطناعية مؤكدة البريد:
-- owner-local@example.test (مُهيّأ عبر bootstrap-initial-owner.sql)،
-- manager-local@example.test (pending)، member-local@example.test (pending)،
-- pending-local@example.test (بريد غير مؤكد).
-- كل تغييرات هذا الملف محصورة داخل معاملة تنتهي بـ ROLLBACK.

\set ON_ERROR_STOP on
BEGIN;

SELECT id AS owner_id FROM auth.users WHERE email='owner-local@example.test' AND email_confirmed_at IS NOT NULL \gset
SELECT id AS manager_id FROM auth.users WHERE email='manager-local@example.test' AND email_confirmed_at IS NOT NULL \gset
SELECT id AS member_id FROM auth.users WHERE email='member-local@example.test' AND email_confirmed_at IS NOT NULL \gset
SELECT id AS pending_id FROM auth.users WHERE email='pending-local@example.test' AND email_confirmed_at IS NULL \gset

SELECT set_config('saytara.test.manager_id', :'manager_id', true);
SELECT set_config('saytara.test.member_id', :'member_id', true);
SELECT set_config('saytara.test.pending_id', :'pending_id', true);
SELECT set_config('request.jwt.claim.sub', :'owner_id', true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_manager uuid := current_setting('saytara.test.manager_id')::uuid;
  v_member uuid := current_setting('saytara.test.member_id')::uuid;
  v_count integer;
  v_blocked boolean;
BEGIN
  IF NOT public.is_platform_owner() THEN RAISE EXCEPTION 'FAIL: bootstrapped owner not recognized'; END IF;
  IF NOT public.has_role(auth.uid(), 'manager'::public.app_role) THEN RAISE EXCEPTION 'FAIL: owner lacks manager-level compatibility'; END IF;
  PERFORM public.review_account_application(v_manager, 'approved', 'Owner hierarchy smoke test');
  PERFORM public.manage_platform_role(v_manager, 'manager'::public.app_role, 'grant', 'Local owner hierarchy smoke test');
  PERFORM public.set_platform_account_access(v_manager, 'suspend', 'Local owner suspension smoke test');
  IF (SELECT p.account_status FROM public.profiles p WHERE p.user_id = v_manager) <> 'rejected' THEN
    RAISE EXCEPTION 'FAIL: owner could not suspend an approved account';
  END IF;
  PERFORM public.set_platform_account_access(v_manager, 'restore', 'Local owner restoration smoke test');
  IF (SELECT p.account_status FROM public.profiles p WHERE p.user_id = v_manager) <> 'approved' THEN
    RAISE EXCEPTION 'FAIL: owner could not restore a suspended account';
  END IF;
  PERFORM public.set_platform_setting('owner_invitations_enabled', false, 'Local owner settings smoke test');
  IF public.is_owner_invitations_enabled() THEN RAISE EXCEPTION 'FAIL: owner invitation setting did not change'; END IF;
  SELECT count(*) INTO v_count FROM public.list_platform_accounts() a WHERE a.is_platform_owner;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: owner account list does not identify exactly one owner'; END IF;
  IF has_table_privilege('authenticated', 'public.user_roles', 'INSERT')
     OR has_table_privilege('authenticated', 'public.user_roles', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.user_roles', 'DELETE') THEN
    RAISE EXCEPTION 'FAIL: authenticated role retains direct user_roles write privileges';
  END IF;
  IF has_table_privilege('authenticated', 'public.platform_settings', 'SELECT')
     OR has_table_privilege('authenticated', 'public.platform_owner_audit', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: owner-only tables are directly readable by authenticated clients';
  END IF;
  IF v_member IS NULL THEN RAISE EXCEPTION 'FAIL: member fixture is missing'; END IF;
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :'manager_id', true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', :'manager_id', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_member uuid := current_setting('saytara.test.member_id')::uuid;
  v_blocked boolean := false;
  v_message text;
BEGIN
  IF public.is_platform_owner() THEN RAISE EXCEPTION 'FAIL: manager was mistaken for owner'; END IF;
  IF NOT public.has_role(auth.uid(), 'manager'::public.app_role) THEN RAISE EXCEPTION 'FAIL: manager fixture role missing'; END IF;
  BEGIN
    PERFORM public.manage_platform_role(v_member, 'verified'::public.app_role, 'grant', 'Must be denied');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    v_blocked := v_message = 'Owner access required';
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: manager could change an application role'; END IF;
  v_blocked := false;
  BEGIN
    PERFORM public.set_platform_account_access(v_member, 'suspend', 'Must be denied');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    v_blocked := v_message = 'Owner access required';
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: manager could suspend another account'; END IF;
  v_blocked := false;
  BEGIN
    PERFORM public.set_platform_setting('owner_invitations_enabled', true, 'Must be denied');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    v_blocked := v_message = 'Owner access required';
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: manager could change owner-only settings'; END IF;
  v_blocked := false;
  BEGIN
    PERFORM 1 FROM public.list_platform_accounts();
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    v_blocked := v_message = 'Owner access required';
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: manager could access the owner account list'; END IF;
  v_blocked := false;
  BEGIN
    PERFORM public.is_owner_invitations_enabled();
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    v_blocked := v_message = 'Owner access required';
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: manager could read the owner invitation setting'; END IF;
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :'pending_id', true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', :'pending_id', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF public.is_platform_owner() THEN RAISE EXCEPTION 'FAIL: pending member was treated as owner'; END IF;
  IF public.has_role(auth.uid(), 'manager'::public.app_role) THEN RAISE EXCEPTION 'FAIL: pending member gained manager-level access'; END IF;
  BEGIN
    UPDATE public.profiles SET account_status='approved' WHERE user_id=auth.uid();
  EXCEPTION WHEN OTHERS THEN
    NULL; -- either column grants, RLS, or the protected-field trigger must reject it
  END;
END;
$$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT account_status FROM public.profiles WHERE user_id=current_setting('saytara.test.pending_id')::uuid) <> 'pending' THEN
    RAISE EXCEPTION 'FAIL: pending user changed their own account status';
  END IF;
END;
$$;

ROLLBACK;
\echo 'PASS: isolated owner bootstrap/RPCs; owner-only role, settings, and account suspension/restoration; manager denial; direct-write privileges removed; pending users cannot self-approve. All test changes rolled back.'
