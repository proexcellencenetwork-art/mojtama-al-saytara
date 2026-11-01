REVOKE EXECUTE ON FUNCTION public.get_owner_site_analytics(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_owner_site_analytics(integer) TO authenticated;
