-- One-transaction upgrade for the already initialized Supabase project.
-- Includes migrations 014–016; do not use this on a fresh database (use setup.sql).
BEGIN;

-- Migration 014 — email-confirmed accounts stay pending until manager approval.
-- Existing profiles are preserved as approved; new Auth users are explicitly pending.
-- Apply to an existing Supabase project only after reviewing the change and taking a backup.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_reviewed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_review_reason text;

-- Preserve access for existing confirmed members. Old unconfirmed sign-ups must still
-- confirm email and then enter the manager queue; they are not silently activated.
UPDATE public.profiles p
SET account_status = CASE WHEN EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = p.user_id AND u.email_confirmed_at IS NOT NULL
) THEN 'approved' ELSE 'pending' END
WHERE p.account_status IS NULL;
ALTER TABLE public.profiles ALTER COLUMN account_status SET DEFAULT 'pending';
ALTER TABLE public.profiles ALTER COLUMN account_status SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_account_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_status_check
      CHECK (account_status IN ('pending','approved','rejected'));
  END IF;
END $$;

ALTER TABLE public.moderation_actions
  DROP CONSTRAINT IF EXISTS moderation_actions_action_check;
ALTER TABLE public.moderation_actions
  ADD CONSTRAINT moderation_actions_action_check
  CHECK (action IN ('hide','remove','restore','suspend','unsuspend','verification_decision','account_decision'));

-- This helper always evaluates the caller's own account; SECURITY DEFINER bypasses
-- profiles RLS so the pending user's own status can be checked without recursion.
CREATE OR REPLACE FUNCTION public.is_account_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT p.account_status = 'approved'
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
  ), false);
$$;
REVOKE ALL ON FUNCTION public.is_account_approved() FROM PUBLIC;
-- Anonymous callers receive only false (auth.uid() is NULL); this grant is needed
-- because the public coach view references the helper even for its anonymous branch.
GRANT EXECUTE ON FUNCTION public.is_account_approved() TO anon, authenticated, service_role;

-- Role-gated policies/functions are unavailable to pending callers. Approved users
-- may inspect their own roles; only public, approved coach status is observable for
-- another user. Staff and service-role operations retain their required checks.
CREATE OR REPLACE FUNCTION public.has_role(p_user uuid, p_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role' THEN EXISTS (
      SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role = p_role
    )
    WHEN NOT public.is_account_approved() THEN false
    WHEN p_user = auth.uid() THEN EXISTS (
      SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role = p_role
    )
    WHEN p_role = 'coach' THEN EXISTS (
      SELECT 1 FROM public.user_roles r
      JOIN public.profiles p ON p.user_id = r.user_id
      WHERE r.user_id = p_user AND r.role = 'coach'
        AND p.account_status = 'approved' AND p.visibility = 'public'
    )
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles staff
      WHERE staff.user_id = auth.uid() AND staff.role IN ('moderator','manager')
    ) AND EXISTS (
      SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role = p_role
    )
  END;
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Use invoker RLS for the public directory. Role records are not visible to every
-- signed-in account: self/staff plus the public coach badge are the only exceptions.
DROP POLICY IF EXISTS "Coach pages public" ON public.coach_profiles;
DROP POLICY IF EXISTS "Signed-in coach profile access" ON public.coach_profiles;
DROP POLICY IF EXISTS "Approved public coach pages" ON public.coach_profiles;
CREATE POLICY "Approved public coach pages"
ON public.coach_profiles FOR SELECT TO anon, authenticated
USING (
  user_id = auth.uid()
  OR public.is_staff()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles r ON r.user_id = p.user_id
    WHERE p.user_id = coach_profiles.user_id AND r.role = 'coach'
      AND p.account_status = 'approved' AND p.visibility = 'public'
  )
);
GRANT SELECT ON public.coach_profiles TO anon, authenticated;

DROP POLICY IF EXISTS "Roles visible to signed in users" ON public.user_roles;
DROP POLICY IF EXISTS "Public approved coach role badges" ON public.user_roles;
CREATE POLICY "Public approved coach role badges"
ON public.user_roles FOR SELECT TO anon
USING (
  role = 'coach' AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = user_roles.user_id
      AND p.account_status = 'approved' AND p.visibility = 'public'
  )
);
DROP POLICY IF EXISTS "Users read own roles or public coach badges" ON public.user_roles;
CREATE POLICY "Users read own roles or public coach badges"
ON public.user_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR public.is_staff()
  OR (role = 'coach' AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = user_roles.user_id
      AND p.account_status = 'approved' AND p.visibility = 'public'
  ))
);
GRANT SELECT ON public.user_roles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_staff(p_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user IS DISTINCT FROM auth.uid() THEN RETURN false; END IF;
  RETURN public.has_role(p_user, 'moderator') OR public.has_role(p_user, 'manager');
END;
$$;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO anon, authenticated, service_role;

-- New users (email or a future OAuth provider) always start pending; provider metadata
-- can populate display fields but can never set account status or roles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  metadata jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  profile_name text;
  profile_photo text;
BEGIN
  profile_name := COALESCE(
    NULLIF(BTRIM(metadata->>'display_name'), ''),
    NULLIF(BTRIM(metadata->>'full_name'), ''),
    NULLIF(BTRIM(metadata->>'name'), ''),
    NULLIF(BTRIM(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1)), ''),
    'عضو جديد'
  );
  profile_name := LEFT(profile_name, 100);
  profile_photo := COALESCE(
    NULLIF(BTRIM(metadata->>'avatar_url'), ''),
    NULLIF(BTRIM(metadata->>'picture'), '')
  );
  IF profile_photo IS NOT NULL AND (LENGTH(profile_photo) > 2048 OR profile_photo !~ '^https://') THEN
    profile_photo := NULL;
  END IF;

  INSERT INTO public.profiles(user_id, display_name, photo_url, account_status)
  VALUES (NEW.id, profile_name, profile_photo, 'pending')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles(user_id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Users may read only their own pending status. Approved callers may read approved
-- public profiles; pending profiles are never exposed through direct table access.
DROP POLICY IF EXISTS "Public or signed-in profile read" ON public.profiles;
DROP POLICY IF EXISTS "Signed-in users read permitted profiles" ON public.profiles;
CREATE POLICY "Approved users read approved profiles or own status"
ON public.profiles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (
    public.is_account_approved()
    AND account_status = 'approved'
    AND (visibility = 'public' OR public.is_staff())
  )
);
DROP POLICY IF EXISTS "Anonymous reads approved public profiles" ON public.profiles;
CREATE POLICY "Anonymous reads approved public profiles"
ON public.profiles FOR SELECT TO anon
USING (account_status = 'approved' AND visibility = 'public');
DROP POLICY IF EXISTS "Pending users may read only own profile" ON public.profiles;
CREATE POLICY "Pending users may read only own profile"
ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_account_approved() OR user_id = auth.uid());
DROP POLICY IF EXISTS "Approved accounts only may edit profiles" ON public.profiles;
CREATE POLICY "Approved accounts only may edit profiles"
ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.is_account_approved())
WITH CHECK (public.is_account_approved());

-- The manager-only RPC is the sole client-facing path that changes review fields.
CREATE OR REPLACE FUNCTION public.guard_account_approval_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() = 'service_role'
     OR current_setting('saytara.account_approval_rpc', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.account_reviewed_at IS DISTINCT FROM OLD.account_reviewed_at
     OR NEW.account_reviewed_by IS DISTINCT FROM OLD.account_reviewed_by
     OR NEW.account_review_reason IS DISTINCT FROM OLD.account_review_reason THEN
    RAISE EXCEPTION 'Only the manager account-review function may change account approval fields.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_account_approval_guard ON public.profiles;
CREATE TRIGGER profiles_account_approval_guard
BEFORE UPDATE OF account_status, account_reviewed_at, account_reviewed_by, account_review_reason
ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.guard_account_approval_fields();

CREATE OR REPLACE FUNCTION public.list_pending_account_reviews()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  profession text,
  specialty text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_account_approved() OR NOT public.has_role(auth.uid(), 'manager') THEN
    RAISE EXCEPTION 'Manager access required';
  END IF;
  RETURN QUERY
    SELECT p.user_id, u.email::text, p.display_name, p.profession, p.specialty, p.created_at
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.account_status = 'pending'
      AND u.email_confirmed_at IS NOT NULL
    ORDER BY p.created_at ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.list_pending_account_reviews() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_account_reviews() TO authenticated;

CREATE OR REPLACE FUNCTION public.review_account_application(
  p_user_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reviewed_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_account_approved() OR NOT public.has_role(auth.uid(), 'manager') THEN
    RAISE EXCEPTION 'Manager access required';
  END IF;
  IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'A manager cannot review their own account';
  END IF;
  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Unsupported account decision';
  END IF;
  IF p_decision = 'rejected' AND COALESCE(NULLIF(BTRIM(p_reason), ''), '') = '' THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;
  IF LENGTH(COALESCE(p_reason, '')) > 1200 THEN
    RAISE EXCEPTION 'Review reason is too long';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = p_user_id AND u.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'The account must confirm its email before review';
  END IF;

  PERFORM set_config('saytara.account_approval_rpc', 'on', true);
  UPDATE public.profiles
     SET account_status = p_decision,
         account_reviewed_at = clock_timestamp(),
         account_reviewed_by = auth.uid(),
         account_review_reason = NULLIF(BTRIM(p_reason), '')
   WHERE user_id = p_user_id AND account_status = 'pending'
   RETURNING * INTO reviewed_profile;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending account not found or already reviewed';
  END IF;

  INSERT INTO public.moderation_actions(moderator_id, subject_user_id, target_type, target_id, action, reason)
  VALUES (
    auth.uid(), reviewed_profile.user_id, 'account', reviewed_profile.user_id,
    'account_decision',
    LEFT(p_decision || CASE WHEN NULLIF(BTRIM(p_reason), '') IS NULL THEN '' ELSE ': ' || BTRIM(p_reason) END, 1500)
  );

  PERFORM set_config('saytara.account_approval_rpc', 'off', true);

  RETURN jsonb_build_object(
    'user_id', reviewed_profile.user_id,
    'account_status', reviewed_profile.account_status,
    'reviewed_at', reviewed_profile.account_reviewed_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.review_account_application(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_account_application(uuid, text, text) TO authenticated;

-- These SECURITY DEFINER functions are trigger/event-trigger entry points, not RPCs.
-- Revoke their default PUBLIC EXECUTE grants so anon/authenticated cannot call them directly.
REVOKE ALL ON FUNCTION public.enforce_message_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_post_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_article_publication() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_booking_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_booking_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_coach_availability_overlap() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_connection_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_content_moderation_state() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_message_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_notification_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_report_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_verification_document_path() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_verified_document_removal() FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.sync_coach_availability() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_account_approval_fields() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.set_updated_at() SET search_path = '';

-- A restrictive policy is ANDed with each existing permissive policy. Thus all
-- authenticated member actions/data are blocked for pending/rejected accounts,
-- while anonymous public-page reads keep their intended behavior.
DO $$
DECLARE
  target_table text;
  protected_tables text[] := ARRAY[
    'user_roles','verification_requests','posts','comments','post_likes','saved_posts',
    'connections','user_blocks','conversations','messages','notifications','groups',
    'group_memberships','events','event_rsvps','articles','coach_profiles',
    'coach_availability','coaching_bookings','membership_plans','memberships','reports',
    'moderation_actions','verification_cleanup_queue'
  ];
BEGIN
  FOREACH target_table IN ARRAY protected_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'approved_account_required', target_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_account_approved()) WITH CHECK (public.is_account_approved())',
      'approved_account_required', target_table
    );
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "Approved account required for verification storage" ON storage.objects;
CREATE POLICY "Approved account required for verification storage"
ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING (public.is_account_approved())
WITH CHECK (public.is_account_approved());

-- This directory view runs with caller privileges and relies on the narrow RLS
-- policies above instead of bypassing them as the view owner.
CREATE OR REPLACE VIEW public.public_coaches WITH (security_barrier = true, security_invoker = true) AS
SELECT p.user_id, p.display_name, p.headline, p.profession, p.specialty, p.city, p.photo_url,
       cp.public_bio, cp.coaching_topics, cp.session_minutes, cp.booking_enabled
FROM public.profiles p
JOIN public.coach_profiles cp ON cp.user_id = p.user_id
JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'coach'
WHERE p.visibility = 'public'
  AND p.account_status = 'approved'
  AND (auth.uid() IS NULL OR public.is_account_approved());
GRANT SELECT ON public.public_coaches TO anon, authenticated;

-- Migration 015 — scope anonymous reads without exposing SECURITY DEFINER helpers as RPCs.
-- The signed-in policies retain existing member/staff behavior; public policies expose published/public rows only.

REVOKE ALL ON FUNCTION public.is_account_approved() FROM anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_active_group_member(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_group_owner(uuid) FROM anon;

-- Anonymous readers see published content only; staff-only draft/moderation access stays authenticated.
DROP POLICY IF EXISTS "Published articles public" ON public.articles;
CREATE POLICY "Published articles public"
ON public.articles FOR SELECT TO anon
USING (status = 'published');
DROP POLICY IF EXISTS "Signed-in articles visible" ON public.articles;
CREATE POLICY "Signed-in articles visible"
ON public.articles FOR SELECT TO authenticated
USING (status = 'published' OR author_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "Published events visible" ON public.events;
CREATE POLICY "Published events visible"
ON public.events FOR SELECT TO anon
USING (NOT is_private AND moderation_state = 'visible');
DROP POLICY IF EXISTS "Signed-in events visible" ON public.events;
CREATE POLICY "Signed-in events visible"
ON public.events FOR SELECT TO authenticated
USING ((NOT is_private AND moderation_state = 'visible') OR organizer_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "Public groups or members read" ON public.groups;
CREATE POLICY "Public groups or members read"
ON public.groups FOR SELECT TO anon
USING (is_public AND moderation_state = 'active');
DROP POLICY IF EXISTS "Signed-in users read permitted groups" ON public.groups;
CREATE POLICY "Signed-in users read permitted groups"
ON public.groups FOR SELECT TO authenticated
USING (
  (is_public AND moderation_state = 'active')
  OR owner_id = auth.uid()
  OR public.is_staff()
  OR EXISTS (
    SELECT 1 FROM public.group_memberships gm
    WHERE gm.group_id = groups.id AND gm.user_id = auth.uid() AND gm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Active membership plans public" ON public.membership_plans;
CREATE POLICY "Active membership plans public"
ON public.membership_plans FOR SELECT TO anon
USING (is_active);
DROP POLICY IF EXISTS "Signed-in membership plans visible" ON public.membership_plans;
CREATE POLICY "Signed-in membership plans visible"
ON public.membership_plans FOR SELECT TO authenticated
USING (is_active OR public.is_staff());

DROP POLICY IF EXISTS "Approved public coach pages" ON public.coach_profiles;
DROP POLICY IF EXISTS "Approved public coach pages authenticated" ON public.coach_profiles;
CREATE POLICY "Approved public coach pages"
ON public.coach_profiles FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles r ON r.user_id = p.user_id
    WHERE p.user_id = coach_profiles.user_id AND r.role = 'coach'
      AND p.account_status = 'approved' AND p.visibility = 'public'
  )
);
CREATE POLICY "Approved public coach pages authenticated"
ON public.coach_profiles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_staff()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles r ON r.user_id = p.user_id
    WHERE p.user_id = coach_profiles.user_id AND r.role = 'coach'
      AND p.account_status = 'approved' AND p.visibility = 'public'
  )
);

-- The view is invoker-secured; underlying RLS now decides which public rows are visible.
CREATE OR REPLACE VIEW public.public_coaches WITH (security_barrier = true, security_invoker = true) AS
SELECT p.user_id, p.display_name, p.headline, p.profession, p.specialty, p.city, p.photo_url,
       cp.public_bio, cp.coaching_topics, cp.session_minutes, cp.booking_enabled
FROM public.profiles p
JOIN public.coach_profiles cp ON cp.user_id = p.user_id
JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'coach'
WHERE p.visibility = 'public'
  AND p.account_status = 'approved';
GRANT SELECT ON public.public_coaches TO anon, authenticated;

-- ===== Source: supabase/migrations/202610040001_platform_owner_hierarchy.sql =====
-- Migration 016 — single platform owner above managers.
-- The owner identity is provisioned once by a project operator using bootstrap-initial-owner.sql.
-- Managers cannot mutate user_roles directly; all role changes go through an owner-checked RPC.


CREATE TABLE IF NOT EXISTS public.platform_owner (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton IS TRUE),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  email_snapshot text NOT NULL CHECK (email_snapshot = lower(btrim(email_snapshot))),
  activated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.platform_owner ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_owner FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.platform_owner_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_email text NOT NULL CHECK (char_length(target_email) <= 320),
  action text NOT NULL CONSTRAINT platform_owner_audit_action_check
    CHECK (action IN ('owner_bootstrap','role_granted','role_revoked','setting_changed','account_suspended','account_restored')),
  role public.app_role,
  setting_key text,
  setting_value jsonb,
  reason text NOT NULL DEFAULT '' CHECK (char_length(reason) <= 1000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS platform_owner_audit_created_idx
  ON public.platform_owner_audit(created_at DESC);
ALTER TABLE public.platform_owner_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_owner_audit FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.platform_settings (
  setting_key text PRIMARY KEY CHECK (setting_key IN ('owner_invitations_enabled')),
  value_boolean boolean NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_settings FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO public.platform_settings(setting_key, value_boolean)
VALUES ('owner_invitations_enabled', true)
ON CONFLICT (setting_key) DO NOTHING;

-- Remove the legacy manager-wide write policy and the underlying API mutation grants.
DROP POLICY IF EXISTS "Managers administer roles" ON public.user_roles;
REVOKE ALL ON TABLE public.user_roles FROM anon, authenticated;
GRANT SELECT ON TABLE public.user_roles TO anon, authenticated;

-- Defense in depth: future permissive policies still cannot authorize direct API writes.
DROP POLICY IF EXISTS "API cannot insert role assignments" ON public.user_roles;
CREATE POLICY "API cannot insert role assignments"
  ON public.user_roles AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (false);
DROP POLICY IF EXISTS "API cannot update role assignments" ON public.user_roles;
CREATE POLICY "API cannot update role assignments"
  ON public.user_roles AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "API cannot delete role assignments" ON public.user_roles;
CREATE POLICY "API cannot delete role assignments"
  ON public.user_roles AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (false);

CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_owner po
    JOIN auth.users u ON u.id = po.user_id
    JOIN public.profiles p ON p.user_id = po.user_id
    WHERE po.singleton IS TRUE
      AND po.user_id = auth.uid()
      AND lower(btrim(u.email)) = po.email_snapshot
      AND u.email_confirmed_at IS NOT NULL
      AND p.account_status = 'approved'
  );
$$;
REVOKE ALL ON FUNCTION public.is_platform_owner() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_owner() TO authenticated;

-- Self-only identity check for destructive account workflows; unlike the active-owner
-- predicate it remains true if the owner temporarily loses email confirmation/approval.
CREATE OR REPLACE FUNCTION public.is_platform_owner_identity()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_owner po
    WHERE po.singleton IS TRUE AND po.user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_platform_owner_identity() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_owner_identity() TO authenticated;

-- A verified, approved owner receives manager-level checks implicitly without a manager row.
CREATE OR REPLACE FUNCTION public.has_role(p_user uuid, p_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role' THEN EXISTS (
      SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role = p_role
    )
    WHEN NOT public.is_account_approved() THEN false
    WHEN p_user = auth.uid()
      AND p_role = 'manager'::public.app_role
      AND public.is_platform_owner() THEN true
    WHEN p_user = auth.uid() THEN EXISTS (
      SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role = p_role
    )
    WHEN p_role = 'coach'::public.app_role THEN EXISTS (
      SELECT 1 FROM public.user_roles r
      JOIN public.profiles p ON p.user_id = r.user_id
      WHERE r.user_id = p_user AND r.role = 'coach'::public.app_role
        AND p.account_status = 'approved' AND p.visibility = 'public'
    )
    ELSE (
      public.is_platform_owner()
      OR EXISTS (
        SELECT 1 FROM public.user_roles staff
        WHERE staff.user_id = auth.uid()
          AND staff.role IN ('moderator'::public.app_role,'manager'::public.app_role)
      )
    ) AND EXISTS (
      SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role = p_role
    )
  END;
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_staff(p_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user IS DISTINCT FROM auth.uid() THEN RETURN false; END IF;
  RETURN public.is_platform_owner()
    OR public.has_role(p_user, 'moderator'::public.app_role)
    OR public.has_role(p_user, 'manager'::public.app_role);
END;
$$;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_platform_accounts()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  account_status text,
  email_confirmed boolean,
  is_platform_owner boolean,
  roles public.app_role[],
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;
  RETURN QUERY
    SELECT u.id, u.email::text, p.display_name, p.account_status, (u.email_confirmed_at IS NOT NULL),
           EXISTS (SELECT 1 FROM public.platform_owner po WHERE po.user_id = u.id),
           COALESCE(array_agg(r.role ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL), ARRAY[]::public.app_role[]),
           u.created_at
    FROM auth.users u
    JOIN public.profiles p ON p.user_id = u.id
    LEFT JOIN public.user_roles r ON r.user_id = u.id
    WHERE u.deleted_at IS NULL
    GROUP BY u.id, u.email, p.display_name, p.account_status, u.email_confirmed_at, u.created_at
    ORDER BY u.created_at DESC
    LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.list_platform_accounts() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_platform_accounts() TO authenticated;

CREATE OR REPLACE FUNCTION public.manage_platform_role(
  p_user_id uuid,
  p_role public.app_role,
  p_action text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_changed integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;
  IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'The owner cannot manage their own role assignments';
  END IF;
  IF p_role IS NULL OR p_role NOT IN (
    'verified'::public.app_role, 'coach'::public.app_role,
    'moderator'::public.app_role, 'manager'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Unsupported managed role';
  END IF;
  IF p_action NOT IN ('grant','revoke') THEN
    RAISE EXCEPTION 'Unsupported role action';
  END IF;
  IF COALESCE(NULLIF(btrim(p_reason), ''), '') = '' OR length(p_reason) > 1000 THEN
    RAISE EXCEPTION 'A reason between 1 and 1000 characters is required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.platform_owner po WHERE po.user_id = p_user_id) THEN
    RAISE EXCEPTION 'The platform owner is not managed through application roles';
  END IF;
  SELECT u.email::text INTO v_email
  FROM auth.users u
  JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = p_user_id
    AND u.deleted_at IS NULL
    AND u.email_confirmed_at IS NOT NULL
    AND p.account_status = 'approved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target account must exist, confirm email, and be approved first';
  END IF;

  IF p_action = 'grant' THEN
    INSERT INTO public.user_roles(user_id, role, granted_by)
    VALUES (p_user_id, p_role, auth.uid())
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = p_user_id AND role = p_role;
  END IF;
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  IF v_changed = 0 THEN
    RAISE EXCEPTION 'No role change was made; the assignment may already be in that state';
  END IF;

  INSERT INTO public.platform_owner_audit(actor_id, target_user_id, target_email, action, role, reason)
  VALUES (
    auth.uid(), p_user_id, lower(btrim(v_email)),
    CASE WHEN p_action = 'grant' THEN 'role_granted' ELSE 'role_revoked' END,
    p_role, btrim(p_reason)
  );
  RETURN jsonb_build_object('user_id', p_user_id, 'role', p_role, 'action', p_action, 'changed', true);
END;
$$;
REVOKE ALL ON FUNCTION public.manage_platform_role(uuid, public.app_role, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.manage_platform_role(uuid, public.app_role, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_owner_invitations_enabled()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_enabled boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;
  SELECT s.value_boolean INTO v_enabled
  FROM public.platform_settings s
  WHERE s.setting_key = 'owner_invitations_enabled';
  RETURN COALESCE(v_enabled, false);
END;
$$;
REVOKE ALL ON FUNCTION public.is_owner_invitations_enabled() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_owner_invitations_enabled() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_platform_setting(
  p_key text,
  p_value boolean,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_previous boolean;
  v_owner_email text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;
  IF p_key IS DISTINCT FROM 'owner_invitations_enabled' OR p_value IS NULL THEN
    RAISE EXCEPTION 'Unsupported platform setting';
  END IF;
  IF COALESCE(NULLIF(btrim(p_reason), ''), '') = '' OR length(p_reason) > 1000 THEN
    RAISE EXCEPTION 'A reason between 1 and 1000 characters is required';
  END IF;
  SELECT lower(btrim(u.email)) INTO v_owner_email
  FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owner email must be confirmed'; END IF;
  SELECT s.value_boolean INTO v_previous
  FROM public.platform_settings s
  WHERE s.setting_key = p_key
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Platform setting is not initialized'; END IF;
  IF v_previous = p_value THEN RAISE EXCEPTION 'Setting already has the requested value'; END IF;

  UPDATE public.platform_settings
  SET value_boolean = p_value, updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE setting_key = p_key;
  INSERT INTO public.platform_owner_audit(actor_id, target_email, action, setting_key, setting_value, reason)
  VALUES (auth.uid(), v_owner_email, 'setting_changed', p_key, to_jsonb(p_value), btrim(p_reason));
  RETURN jsonb_build_object('setting_key', p_key, 'value', p_value, 'changed', true);
END;
$$;
REVOKE ALL ON FUNCTION public.set_platform_setting(text, boolean, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_platform_setting(text, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_platform_account_access(
  p_user_id uuid,
  p_action text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_status text;
  v_next_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;
  IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'The owner cannot suspend or restore their own account';
  END IF;
  IF p_action NOT IN ('suspend','restore') THEN
    RAISE EXCEPTION 'Unsupported account access action';
  END IF;
  IF COALESCE(NULLIF(btrim(p_reason), ''), '') = '' OR length(p_reason) > 1000 THEN
    RAISE EXCEPTION 'A reason between 1 and 1000 characters is required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.platform_owner po WHERE po.user_id = p_user_id) THEN
    RAISE EXCEPTION 'The platform owner account cannot be suspended through the app';
  END IF;
  SELECT u.email::text, p.account_status INTO v_email, v_status
  FROM auth.users u
  JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = p_user_id AND u.deleted_at IS NULL AND u.email_confirmed_at IS NOT NULL
  FOR UPDATE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target account must exist and confirm email first'; END IF;
  IF p_action = 'suspend' AND v_status = 'approved' THEN
    v_next_status := 'rejected';
  ELSIF p_action = 'restore' AND v_status = 'rejected' THEN
    v_next_status := 'approved';
  ELSE
    RAISE EXCEPTION 'Only approved accounts can be suspended and only rejected accounts can be restored';
  END IF;

  PERFORM set_config('saytara.account_approval_rpc', 'on', true);
  UPDATE public.profiles
  SET account_status = v_next_status,
      account_reviewed_at = clock_timestamp(),
      account_reviewed_by = auth.uid(),
      account_review_reason = btrim(p_reason)
  WHERE user_id = p_user_id;
  PERFORM set_config('saytara.account_approval_rpc', 'off', true);

  INSERT INTO public.platform_owner_audit(actor_id, target_user_id, target_email, action, reason)
  VALUES (
    auth.uid(), p_user_id, lower(btrim(v_email)),
    CASE WHEN p_action = 'suspend' THEN 'account_suspended' ELSE 'account_restored' END,
    btrim(p_reason)
  );
  RETURN jsonb_build_object('user_id', p_user_id, 'account_status', v_next_status, 'action', p_action);
END;
$$;
REVOKE ALL ON FUNCTION public.set_platform_account_access(uuid, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_platform_account_access(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_platform_owner_audit(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id bigint,
  actor_id uuid,
  target_user_id uuid,
  target_email text,
  action text,
  role public.app_role,
  setting_key text,
  setting_value jsonb,
  reason text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;
  RETURN QUERY
    SELECT a.id, a.actor_id, a.target_user_id, a.target_email, a.action, a.role,
           a.setting_key, a.setting_value, a.reason, a.created_at
    FROM public.platform_owner_audit a
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
END;
$$;
REVOKE ALL ON FUNCTION public.list_platform_owner_audit(integer) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_platform_owner_audit(integer) TO authenticated;

-- Keep account-review operations available to the owner via the has_role('manager') compatibility check.
-- Managers can review accounts but cannot assign roles or read the owner audit table.


COMMIT;
