-- Public signup mode: new accounts can join immediately after email confirmation.
-- Existing pending/rejected accounts are not changed by this migration.
-- Apply only after confirming that open membership is the intended community policy.

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
  VALUES (NEW.id, profile_name, profile_photo, 'approved')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles(user_id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

