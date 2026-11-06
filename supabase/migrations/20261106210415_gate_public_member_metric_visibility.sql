-- Keep the public member count aligned with the owner visibility switch.
-- SECURITY DEFINER is intentional: the RPC only returns an aggregate count,
-- never member records, and is granted to anonymous visitors for the public site.
CREATE OR REPLACE FUNCTION public.get_public_community_metric()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH settings AS (
    SELECT
      COALESCE(
        (SELECT s.value_boolean
         FROM public.platform_settings s
         WHERE s.setting_key = 'public_member_metric_visible'),
        false
      ) AS visible,
      CASE
        WHEN (SELECT s.value_text
              FROM public.platform_settings s
              WHERE s.setting_key = 'public_member_metric_mode') = 'goal'
        THEN 'goal'
        ELSE 'actual'
      END AS mode,
      GREATEST(
        0,
        LEAST(
          COALESCE(
            (SELECT s.value_integer
             FROM public.platform_settings s
             WHERE s.setting_key = 'public_member_metric_goal'),
            100
          ),
          1000000
        )
      ) AS goal
  )
  SELECT jsonb_build_object(
    'visible', settings.visible,
    'mode', settings.mode,
    'actual_count',
      CASE
        WHEN settings.visible THEN (
          SELECT count(*)::integer
          FROM public.profiles p
          JOIN auth.users u ON u.id = p.user_id
          WHERE p.account_status = 'approved'
            AND u.email_confirmed_at IS NOT NULL
            AND u.deleted_at IS NULL
            AND NOT EXISTS (
              SELECT 1
              FROM public.platform_owner po
              WHERE po.user_id = u.id
            )
        )
        ELSE NULL
      END,
    'goal', settings.goal
  )
  FROM settings;
$function$;
