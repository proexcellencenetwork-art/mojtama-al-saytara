-- مجتمع السيطرة — تهيئة المالك الأول لمرة واحدة فقط.
-- شغّل هذا الملف يدوياً من Supabase Dashboard > SQL Editor بصلاحية project database owner.
-- قبل التشغيل: أنشئ الحساب بالبريد المعتاد، وافتح رسالة Supabase واضغط رابط تأكيد البريد.
-- استبدل OWNER_EMAIL_HERE بالبريد المقرر حرفياً. لا تلصق كلمة مرور أو access/refresh token هنا.
-- هذا الإجراء يمنح الحساب المؤكد اعتماداً أولياً لأن لا يوجد مدير سابق؛ بقية الحسابات تبقى
-- خاضعة لمسار موافقة المالك/المدير المعتاد. يفشل إذا لم يؤكد البريد أو إذا سبق تعيين مالك.

BEGIN;

DO $bootstrap_owner$
DECLARE
  v_email text := lower(btrim('OWNER_EMAIL_HERE'));
  v_owner_user_id uuid;
  v_status text;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Run this one-time bootstrap from the Supabase SQL Editor as the project database owner.';
  END IF;
  IF v_email = 'owner_email_here' OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Replace OWNER_EMAIL_HERE with the designated email address.';
  END IF;

  LOCK TABLE public.platform_owner IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM public.platform_owner WHERE singleton IS TRUE) THEN
    RAISE EXCEPTION 'A platform owner is already provisioned; this bootstrap is single-use.';
  END IF;

  SELECT u.id INTO v_owner_user_id
  FROM auth.users u
  WHERE lower(btrim(u.email)) = v_email
    AND u.email_confirmed_at IS NOT NULL
    AND u.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active Supabase Auth account with this confirmed email exists.';
  END IF;

  SELECT p.account_status INTO v_status
  FROM public.profiles p
  WHERE p.user_id = v_owner_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The Auth account has no profile; stop and repair account provisioning first.';
  END IF;
  IF v_status = 'rejected' THEN
    RAISE EXCEPTION 'This account is rejected and cannot be bootstrapped as owner.';
  END IF;

  -- The protected approval-field trigger accepts this transaction-local flag only in this
  -- operator-run SQL script; it is not callable through a client RPC.
  PERFORM set_config('saytara.account_approval_rpc', 'on', true);
  UPDATE public.profiles
     SET account_status = 'approved',
         account_reviewed_at = clock_timestamp(),
         account_reviewed_by = NULL,
         account_review_reason = 'Initial platform-owner bootstrap by the project operator after email confirmation.'
   WHERE user_id = v_owner_user_id
     AND account_status <> 'approved';

  INSERT INTO public.platform_owner(singleton, user_id, email_snapshot)
  VALUES (true, v_owner_user_id, v_email);

  INSERT INTO public.platform_owner_audit(actor_id, target_user_id, target_email, action, role, reason)
  VALUES (
    v_owner_user_id,
    v_owner_user_id,
    v_email,
    'owner_bootstrap',
    NULL,
    'One-time initial owner bootstrap through Supabase SQL Editor after verified email confirmation.'
  );

  PERFORM set_config('saytara.account_approval_rpc', 'off', true);
  RAISE NOTICE 'Initial owner provisioned for the confirmed email. Sign in through the normal login screen.';
END;
$bootstrap_owner$;

COMMIT;
