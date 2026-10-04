-- Keep is_staff available to authenticated RLS consumers only; anon policies do not call it.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon;
COMMIT;
