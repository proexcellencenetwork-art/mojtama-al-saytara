-- إضافة روابط خارجية للورش وروابط تعلّم مستقلة.
-- يمكن للمالك أو المدير إضافة رابط https إلى ورشة، أو إنشاء رابط تعلّم مستقل
-- (عنوان + رابط فقط) يظهر لجميع الأعضاء المعتمدين دون اشتراط جاهزية البث.

BEGIN;

-- 1) عمود الرابط الخارجي على الورش
ALTER TABLE public.learning_workshops
  ADD COLUMN IF NOT EXISTS external_link text
  CHECK (external_link IS NULL OR (char_length(external_link) <= 1000 AND external_link ~ '^https://'));

-- 2) جدول روابط التعلّم المستقلة
CREATE TABLE IF NOT EXISTS public.learning_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 140),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  url text NOT NULL CHECK (char_length(url) <= 1000 AND url ~ '^https://'),
  audience_roles public.app_role[] NOT NULL DEFAULT array[
    'member'::public.app_role,
    'verified'::public.app_role,
    'coach'::public.app_role,
    'moderator'::public.app_role,
    'manager'::public.app_role
  ],
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS learning_links_created_idx ON public.learning_links(created_at DESC);

ALTER TABLE public.learning_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.learning_links FROM anon;
GRANT SELECT ON public.learning_links TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.learning_links TO authenticated;

-- قراءة: أي عضو معتمد ضمن الجمهور
DROP POLICY IF EXISTS learning_links_authorized_read ON public.learning_links;
CREATE POLICY learning_links_authorized_read ON public.learning_links
  FOR SELECT TO authenticated
  USING (
    public.can_manage_learning()
    OR EXISTS (
      SELECT 1 FROM unnest(learning_links.audience_roles) AS audience(role)
      WHERE public.has_role(auth.uid(), audience.role)
    )
  );

-- إنشاء/تعديل/حذف: المالك أو المدير فقط
DROP POLICY IF EXISTS learning_links_manage ON public.learning_links;
CREATE POLICY learning_links_manage ON public.learning_links
  FOR ALL TO authenticated
  USING (public.can_manage_learning())
  WITH CHECK (public.can_manage_learning());

-- 3) دالة إضافة رابط تعلّم
CREATE OR REPLACE FUNCTION public.create_learning_link(
  p_title text,
  p_description text DEFAULT '',
  p_url text
) RETURNS public.learning_links
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result public.learning_links;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_learning() THEN
    RAISE EXCEPTION 'Owner or manager access required';
  END IF;
  IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 3 AND 140 THEN
    RAISE EXCEPTION 'Link title must be 3-140 characters';
  END IF;
  IF p_description IS NOT NULL AND char_length(p_description) > 2000 THEN
    RAISE EXCEPTION 'Link description is too long';
  END IF;
  IF p_url IS NULL OR char_length(p_url) > 1000 OR p_url !~ '^https://' THEN
    RAISE EXCEPTION 'Link must use HTTPS';
  END IF;

  INSERT INTO public.learning_links(title, description, url, created_by, updated_by)
  VALUES (btrim(p_title), coalesce(p_description, ''), p_url, auth.uid(), auth.uid())
  RETURNING * INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_learning_link(text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_learning_link(text, text, text) TO authenticated;

-- 4) دالة حذف رابط تعلّم
CREATE OR REPLACE FUNCTION public.delete_learning_link(p_link_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_learning() THEN
    RAISE EXCEPTION 'Owner or manager access required';
  END IF;
  DELETE FROM public.learning_links WHERE id = p_link_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_learning_link(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_learning_link(uuid) TO authenticated;

-- 5) تحديث create_learning_workshop لقبول رابط خارجي (توقيع جديد دون كسر القديم)
CREATE OR REPLACE FUNCTION public.create_learning_workshop(
  p_title text,
  p_description text,
  p_instructor_name text,
  p_scheduled_at timestamptz,
  p_duration_minutes integer,
  p_cover_url text DEFAULT null,
  p_audience_roles public.app_role[] DEFAULT array[
    'member'::public.app_role,'verified'::public.app_role,'coach'::public.app_role,
    'moderator'::public.app_role,'manager'::public.app_role
  ],
  p_external_link text DEFAULT null
) RETURNS public.learning_workshops
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result public.learning_workshops;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_learning() THEN RAISE EXCEPTION 'Owner or manager access required'; END IF;
  IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 3 AND 140 THEN RAISE EXCEPTION 'Workshop title must be 3-140 characters'; END IF;
  IF p_description IS NOT NULL AND char_length(p_description) > 6000 THEN RAISE EXCEPTION 'Workshop description is too long'; END IF;
  IF p_instructor_name IS NULL OR char_length(btrim(p_instructor_name)) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'Instructor name must be 2-120 characters'; END IF;
  IF p_scheduled_at IS NULL OR p_duration_minutes NOT BETWEEN 15 AND 360 THEN RAISE EXCEPTION 'Workshop schedule or duration is invalid'; END IF;
  IF coalesce(cardinality(p_audience_roles),0) NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'Select at least one approved audience role'; END IF;
  IF p_cover_url IS NOT NULL AND (char_length(p_cover_url) > 1000 OR p_cover_url !~ '^https://') THEN RAISE EXCEPTION 'Cover image must use HTTPS'; END IF;
  IF p_external_link IS NOT NULL AND (char_length(p_external_link) > 1000 OR p_external_link !~ '^https://') THEN RAISE EXCEPTION 'External link must use HTTPS'; END IF;

  INSERT INTO public.learning_workshops(
    title, description, instructor_name, scheduled_at, duration_minutes,
    cover_url, audience_roles, external_link, created_by, updated_by
  )
  VALUES(
    btrim(p_title), coalesce(p_description,''), btrim(p_instructor_name), p_scheduled_at, p_duration_minutes,
    nullif(btrim(coalesce(p_cover_url,'')),''), p_audience_roles, nullif(btrim(coalesce(p_external_link,'')),''), auth.uid(), auth.uid()
  )
  RETURNING * INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_learning_workshop FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_learning_workshop TO authenticated;

-- 6) إتاحة القراءة الآمنة للروابط عبر RLS على الورش (العمود الجديد)
-- لا نغير سياسة الورش الحالية؛ القراءة عبر audience_roles + can_access_learning_workshop.

COMMIT;
