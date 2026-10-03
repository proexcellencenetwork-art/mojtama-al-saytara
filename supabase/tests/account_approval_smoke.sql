-- مجتمع السيطرة — اختبار محلي/معزول لحاجز اعتماد الحساب.
-- للتجربة فقط: لا تشغله على الإنتاج. يتطلب قاعدة اختبار محلية بعد setup.sql؛ تُلغى كل البيانات بـ ROLLBACK.
-- ينشئ مستخدمين اصطناعيين عبر trigger auth.users لاختبار البريد المصدق وغير المصدق والعضو والكوتش والمدير.

BEGIN;

INSERT INTO auth.users(id, email, raw_user_meta_data, email_confirmed_at) VALUES
  ('10000000-0000-4000-8000-000000000001','approval-manager@example.test','{"name":"مدير اختبار"}'::jsonb,now()),
  ('10000000-0000-4000-8000-000000000002','approval-pending@example.test','{"name":"عضو معلق"}'::jsonb,now()),
  ('10000000-0000-4000-8000-000000000003','approval-unconfirmed@example.test','{"name":"بريد غير مؤكد"}'::jsonb,NULL),
  ('10000000-0000-4000-8000-000000000004','approval-coach@example.test','{"name":"كوتش عام"}'::jsonb,now());

-- Existing/seeded administrator and coach are approved; new member accounts stay pending.
SELECT set_config('saytara.account_approval_rpc','on',true);
UPDATE public.profiles SET account_status='approved' WHERE user_id='10000000-0000-4000-8000-000000000001';
UPDATE public.profiles SET account_status='approved', visibility='public' WHERE user_id='10000000-0000-4000-8000-000000000004';
UPDATE public.profiles SET visibility='public' WHERE user_id='10000000-0000-4000-8000-000000000002';
INSERT INTO public.user_roles(user_id,role,granted_by) VALUES
  ('10000000-0000-4000-8000-000000000001','manager','10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000004','coach','10000000-0000-4000-8000-000000000001');
INSERT INTO public.coach_profiles(user_id,public_bio,booking_enabled)
VALUES ('10000000-0000-4000-8000-000000000004','نبذة عامة للاختبار',true);
INSERT INTO public.verification_requests(user_id,full_name,profession,professional_registration_no,document_path)
VALUES ('10000000-0000-4000-8000-000000000004','كوتش اختبار','مهنة اختبار','APPROVAL-SMOKE-COACH','10000000-0000-4000-8000-000000000004/smoke.pdf');
INSERT INTO storage.objects(bucket_id,name)
VALUES ('verification-private','10000000-0000-4000-8000-000000000004/smoke.pdf');
INSERT INTO public.conversations(member_a,member_b)
VALUES ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004');
INSERT INTO public.messages(conversation_id,sender_id,recipient_id,body)
SELECT id,'10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','رسالة خاصة للاختبار'
FROM public.conversations
WHERE member_a='10000000-0000-4000-8000-000000000001' AND member_b='10000000-0000-4000-8000-000000000004';
SELECT set_config('saytara.account_approval_rpc','off',true);

-- New users are pending; unconfirmed addresses are excluded from the manager queue.
DO $$
BEGIN
  IF (SELECT account_status FROM public.profiles WHERE user_id='10000000-0000-4000-8000-000000000002') <> 'pending' THEN
    RAISE EXCEPTION 'FAIL: newly confirmed account did not start pending';
  END IF;
  IF (SELECT role FROM public.user_roles WHERE user_id='10000000-0000-4000-8000-000000000002') <> 'member' THEN
    RAISE EXCEPTION 'FAIL: new account did not receive only the member role';
  END IF;
  IF (SELECT account_status FROM public.profiles WHERE user_id='10000000-0000-4000-8000-000000000003') <> 'pending' THEN
    RAISE EXCEPTION 'FAIL: unconfirmed account did not remain pending';
  END IF;
END $$;

-- Unauthenticated public reads are limited to approved public profiles/coaches.
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claim.role','anon',true);
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SET LOCAL ROLE anon;
DO $$
DECLARE v_count integer; v_denied boolean := false;
BEGIN
  SELECT count(*) INTO v_count FROM public.profiles WHERE user_id='10000000-0000-4000-8000-000000000004';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: public approved profile disappeared'; END IF;
  SELECT count(*) INTO v_count FROM public.profiles WHERE user_id='10000000-0000-4000-8000-000000000002';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: anonymous visitor saw a pending profile'; END IF;
  SELECT count(*) INTO v_count FROM public.public_coaches WHERE user_id='10000000-0000-4000-8000-000000000004';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: public approved coach is not visible'; END IF;
  SELECT count(*) INTO v_count FROM public.user_roles WHERE user_id='10000000-0000-4000-8000-000000000004' AND role='coach';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: public coach badge is not visible'; END IF;
  SELECT count(*) INTO v_count FROM public.user_roles WHERE user_id='10000000-0000-4000-8000-000000000001';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: anonymous visitor saw a private manager role'; END IF;
  IF has_function_privilege('anon','public.is_account_approved()','EXECUTE')
     OR has_function_privilege('anon','public.is_staff(uuid)','EXECUTE')
     OR has_function_privilege('anon','public.is_active_group_member(uuid)','EXECUTE')
     OR has_function_privilege('anon','public.is_group_owner(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can directly execute an internal SECURITY DEFINER helper';
  END IF;
  IF has_function_privilege('authenticated','public.enforce_message_rate_limit()','EXECUTE')
     OR has_function_privilege('authenticated','public.enforce_post_rate_limit()','EXECUTE')
     OR has_function_privilege('authenticated','public.guard_article_publication()','EXECUTE')
     OR has_function_privilege('authenticated','public.guard_booking_insert()','EXECUTE')
     OR has_function_privilege('authenticated','public.guard_booking_transition()','EXECUTE')
     OR has_function_privilege('authenticated','public.guard_coach_availability_overlap()','EXECUTE')
     OR has_function_privilege('authenticated','public.guard_connection_transition()','EXECUTE')
     OR has_function_privilege('authenticated','public.guard_content_moderation_state()','EXECUTE')
     OR has_function_privilege('authenticated','public.guard_message_update()','EXECUTE')
     OR has_function_privilege('authenticated','public.guard_notification_update()','EXECUTE')
     OR has_function_privilege('authenticated','public.guard_report_transition()','EXECUTE')
     OR has_function_privilege('authenticated','public.guard_verification_document_path()','EXECUTE')
     OR has_function_privilege('authenticated','public.handle_new_user()','EXECUTE')
     OR has_function_privilege('authenticated','public.queue_verified_document_removal()','EXECUTE')
     OR has_function_privilege('authenticated','public.sync_coach_availability()','EXECUTE')
     OR has_function_privilege('authenticated','public.guard_account_approval_fields()','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated client can directly execute a trigger-only SECURITY DEFINER function';
  END IF;
  BEGIN
    PERFORM public.has_role('10000000-0000-4000-8000-000000000001','manager');
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'FAIL: anon can call the general role lookup'; END IF;
  v_denied := false;
  BEGIN
    PERFORM public.guard_message_update();
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'FAIL: anon can call a trigger-only SECURITY DEFINER function'; END IF;
END $$;
RESET ROLE;

-- Pending authenticated user can read own status only; no member data or elevated controls.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_count integer; v_rows integer; v_denied boolean := false;
BEGIN
  SELECT count(*) INTO v_count FROM public.profiles WHERE user_id='10000000-0000-4000-8000-000000000002' AND account_status='pending';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: pending user cannot read their own status'; END IF;
  SELECT count(*) INTO v_count FROM public.profiles WHERE user_id='10000000-0000-4000-8000-000000000001';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: pending user can read another member profile'; END IF;
  SELECT count(*) INTO v_count FROM public.messages;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: pending user can read private messages'; END IF;
  SELECT count(*) INTO v_count FROM public.verification_requests;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: pending user can read verification requests'; END IF;
  SELECT count(*) INTO v_count FROM storage.objects WHERE bucket_id='verification-private';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: pending user can read private verification files'; END IF;
  SELECT count(*) INTO v_count FROM public.user_roles;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: pending user can read member role records'; END IF;
  BEGIN
    PERFORM * FROM public.list_pending_account_reviews();
  EXCEPTION WHEN OTHERS THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'FAIL: pending user can query the manager queue'; END IF;
  v_denied := false;
  BEGIN
    UPDATE public.user_roles SET role='manager' WHERE user_id='10000000-0000-4000-8000-000000000002';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_denied := v_rows=0;
  EXCEPTION WHEN OTHERS THEN v_denied := true;
  END;
  IF NOT v_denied OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id='10000000-0000-4000-8000-000000000002' AND role='manager') THEN
    RAISE EXCEPTION 'FAIL: pending user escalated their own role';
  END IF;
  v_denied := false;
  BEGIN
    UPDATE public.profiles SET account_status='approved' WHERE user_id='10000000-0000-4000-8000-000000000002';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_denied := v_rows=0;
  EXCEPTION WHEN OTHERS THEN v_denied := true;
  END;
  IF NOT v_denied OR (SELECT account_status FROM public.profiles WHERE user_id='10000000-0000-4000-8000-000000000002') <> 'pending' THEN
    RAISE EXCEPTION 'FAIL: pending user self-approved their account';
  END IF;
  v_denied := false;
  BEGIN
    PERFORM public.guard_message_update();
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'FAIL: authenticated user can call a trigger-only SECURITY DEFINER function'; END IF;
  v_denied := false;
  BEGIN
    INSERT INTO public.posts(author_id,body,visibility) VALUES ('10000000-0000-4000-8000-000000000002','اختبار نشر pending','public');
  EXCEPTION WHEN OTHERS THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'FAIL: pending user published a public post'; END IF;
END $$;
RESET ROLE;

-- Only an approved manager can see/review confirmed pending accounts.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_count integer; v_denied boolean := false; v_status text;
BEGIN
  SELECT count(*) INTO v_count FROM public.list_pending_account_reviews() WHERE user_id='10000000-0000-4000-8000-000000000002';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: manager cannot see a confirmed pending account'; END IF;
  SELECT count(*) INTO v_count FROM public.list_pending_account_reviews() WHERE user_id='10000000-0000-4000-8000-000000000003';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: unconfirmed account appeared in review queue'; END IF;
  BEGIN
    PERFORM public.review_account_application('10000000-0000-4000-8000-000000000003','approved',NULL);
  EXCEPTION WHEN OTHERS THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'FAIL: manager review accepted an unconfirmed account'; END IF;
  PERFORM public.review_account_application('10000000-0000-4000-8000-000000000002','approved',NULL);
  IF current_setting('saytara.account_approval_rpc',true) = 'on' THEN RAISE EXCEPTION 'FAIL: review RPC left the bypass GUC enabled'; END IF;
  SELECT account_status INTO v_status FROM public.profiles WHERE user_id='10000000-0000-4000-8000-000000000002';
  IF v_status <> 'approved' THEN RAISE EXCEPTION 'FAIL: manager approval did not activate the account'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.moderation_actions WHERE subject_user_id='10000000-0000-4000-8000-000000000002' AND action='account_decision') THEN
    RAISE EXCEPTION 'FAIL: account approval was not audited';
  END IF;
  v_denied := false;
  BEGIN
    PERFORM public.review_account_application('10000000-0000-4000-8000-000000000001','rejected','self-review');
  EXCEPTION WHEN OTHERS THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'FAIL: manager reviewed their own account'; END IF;
  v_denied := false;
  BEGIN
    UPDATE public.profiles SET account_status='rejected' WHERE user_id='10000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN OTHERS THEN v_denied := true;
  END;
  IF NOT v_denied OR (SELECT account_status FROM public.profiles WHERE user_id='10000000-0000-4000-8000-000000000001') <> 'approved' THEN
    RAISE EXCEPTION 'FAIL: manager directly edited review fields outside the RPC';
  END IF;
END $$;
RESET ROLE;

-- After approval, the member sees their own role and the public coach badge only.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.user_roles;
  IF v_count <> 2 THEN RAISE EXCEPTION 'FAIL: approved member sees unexpected roles or misses public coach badge'; END IF;
  SELECT count(*) INTO v_count FROM public.user_roles WHERE user_id='10000000-0000-4000-8000-000000000001';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: approved member can read another member private role'; END IF;
  SELECT count(*) INTO v_count FROM public.user_roles WHERE user_id='10000000-0000-4000-8000-000000000002' AND role='member';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: approved member cannot read their own role'; END IF;
END $$;
RESET ROLE;
ROLLBACK;

SELECT 'PASS: new users remain pending; email confirmation gates review; anon sees public coach badges without direct helper RPCs; trigger/helper SECURITY DEFINER RPCs are denied; pending accounts cannot access member data or elevate themselves; approved members cannot read private roles; manager approval is authorized and audited; public coaches remain visible; all fixtures were rolled back.' AS result;
