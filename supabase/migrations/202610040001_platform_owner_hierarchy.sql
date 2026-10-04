-- Migration 016 — single platform owner above managers.
-- The owner identity is provisioned once by a project operator using bootstrap-initial-owner.sql.
-- Managers cannot mutate user_roles directly; all role changes go through an owner-checked RPC.
BEGIN;

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
