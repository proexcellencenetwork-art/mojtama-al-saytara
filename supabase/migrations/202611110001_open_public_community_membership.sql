begin;

-- Public professional community: a confirmed email is sufficient to activate a basic member account.
-- Email-unconfirmed accounts remain pending and are not exposed in the public directory.
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
  VALUES (
    NEW.id,
    profile_name,
    profile_photo,
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN 'approved' ELSE 'pending' END
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles(user_id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Supabase normally confirms email after the Auth user row is created.
-- This trigger activates only that basic member account; it never grants coach/staff roles.
CREATE OR REPLACE FUNCTION public.auto_approve_email_confirmed_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM set_config('saytara.account_approval_rpc', 'on', true);
    UPDATE public.profiles
       SET account_status = 'approved',
           account_reviewed_at = NULL,
           account_reviewed_by = NULL,
           account_review_reason = NULL
     WHERE user_id = NEW.id
       AND account_status = 'pending';
    PERFORM set_config('saytara.account_approval_rpc', 'off', true);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('saytara.account_approval_rpc', 'off', true);
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_approve_email_confirmed_member() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auto_approve_email_confirmed_member ON auth.users;
CREATE TRIGGER auto_approve_email_confirmed_member
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.auto_approve_email_confirmed_member();

-- Existing confirmed pending users can enter too; unconfirmed accounts stay pending.
SELECT set_config('saytara.account_approval_rpc', 'on', true);
UPDATE public.profiles p
   SET account_status = 'approved',
       account_reviewed_at = NULL,
       account_reviewed_by = NULL,
       account_review_reason = NULL
  FROM auth.users u
 WHERE p.user_id = u.id
   AND p.account_status = 'pending'
   AND u.email_confirmed_at IS NOT NULL;
SELECT set_config('saytara.account_approval_rpc', 'off', true);

-- Profiles already default to public visibility. This index supports the open member directory.
CREATE INDEX IF NOT EXISTS profiles_public_directory_idx
  ON public.profiles (visibility, account_status, display_name);

commit;