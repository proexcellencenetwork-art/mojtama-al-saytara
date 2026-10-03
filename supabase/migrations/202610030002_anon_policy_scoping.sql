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
