-- Owner-controlled public community metric.
-- Real approved member count remains database-derived. A manually chosen number is
-- displayed only as a clearly labelled goal, never as a fabricated member count.
BEGIN;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS value_integer integer,
  ADD COLUMN IF NOT EXISTS value_text text;

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_setting_key_check;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_setting_key_check
  CHECK (setting_key IN (
    'owner_invitations_enabled',
    'public_member_metric_visible',
    'public_member_metric_mode',
    'public_member_metric_goal'
  ));

INSERT INTO public.platform_settings(setting_key, value_boolean, value_text, value_integer)
VALUES
  ('public_member_metric_visible', false, NULL, NULL),
  ('public_member_metric_mode', false, 'actual', NULL),
  ('public_member_metric_goal', false, NULL, 100)
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_owner_community_metric_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_visible boolean;
  v_mode text;
  v_goal integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;

  SELECT COALESCE(s.value_boolean, false) INTO v_visible
  FROM public.platform_settings s
  WHERE s.setting_key = 'public_member_metric_visible';
  SELECT COALESCE(s.value_text, 'actual') INTO v_mode
  FROM public.platform_settings s
  WHERE s.setting_key = 'public_member_metric_mode';
  SELECT COALESCE(s.value_integer, 100) INTO v_goal
  FROM public.platform_settings s
  WHERE s.setting_key = 'public_member_metric_goal';

  RETURN jsonb_build_object(
    'visible', COALESCE(v_visible, false),
    'mode', CASE WHEN v_mode IN ('actual','goal') THEN v_mode ELSE 'actual' END,
    'goal', GREATEST(0, LEAST(COALESCE(v_goal,100), 1000000))
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_owner_community_metric_settings() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_owner_community_metric_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_owner_community_metric(
  p_visible boolean,
  p_mode text,
  p_goal integer,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner_email text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;
  IF p_visible IS NULL OR p_mode NOT IN ('actual','goal') OR p_goal IS NULL OR p_goal < 0 OR p_goal > 1000000 THEN
    RAISE EXCEPTION 'Invalid community metric settings';
  END IF;
  IF COALESCE(NULLIF(btrim(p_reason), ''), '') = '' OR length(p_reason) > 1000 THEN
    RAISE EXCEPTION 'A reason between 1 and 1000 characters is required';
  END IF;
  SELECT lower(btrim(u.email)) INTO v_owner_email
  FROM auth.users u
  WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owner email must be confirmed'; END IF;

  UPDATE public.platform_settings
  SET value_boolean = p_visible, updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE setting_key = 'public_member_metric_visible';
  UPDATE public.platform_settings
  SET value_text = p_mode, updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE setting_key = 'public_member_metric_mode';
  UPDATE public.platform_settings
  SET value_integer = p_goal, updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE setting_key = 'public_member_metric_goal';

  INSERT INTO public.platform_owner_audit(actor_id, target_email, action, setting_key, setting_value, reason)
  VALUES
    (auth.uid(), v_owner_email, 'setting_changed', 'public_member_metric_visible', to_jsonb(p_visible), btrim(p_reason)),
    (auth.uid(), v_owner_email, 'setting_changed', 'public_member_metric_mode', to_jsonb(p_mode), btrim(p_reason)),
    (auth.uid(), v_owner_email, 'setting_changed', 'public_member_metric_goal', to_jsonb(p_goal), btrim(p_reason));

  RETURN jsonb_build_object('visible', p_visible, 'mode', p_mode, 'goal', p_goal, 'changed', true);
END;
$$;
REVOKE ALL ON FUNCTION public.set_owner_community_metric(boolean, text, integer, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_owner_community_metric(boolean, text, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_community_metric()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'visible', COALESCE((SELECT s.value_boolean FROM public.platform_settings s WHERE s.setting_key = 'public_member_metric_visible'), false),
    'mode', CASE
      WHEN (SELECT s.value_text FROM public.platform_settings s WHERE s.setting_key = 'public_member_metric_mode') = 'goal' THEN 'goal'
      ELSE 'actual'
    END,
    'actual_count', (
      SELECT count(*)::integer
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.user_id
      WHERE p.account_status = 'approved'
        AND u.email_confirmed_at IS NOT NULL
        AND u.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.platform_owner po WHERE po.user_id = u.id)
    ),
    'goal', GREATEST(0, LEAST(COALESCE((SELECT s.value_integer FROM public.platform_settings s WHERE s.setting_key = 'public_member_metric_goal'), 100), 1000000))
  );
$$;
REVOKE ALL ON FUNCTION public.get_public_community_metric() FROM PUBLIC, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_community_metric() TO anon, authenticated;

COMMIT;
