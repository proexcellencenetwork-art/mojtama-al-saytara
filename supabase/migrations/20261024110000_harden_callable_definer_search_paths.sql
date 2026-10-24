-- Harden callable SECURITY DEFINER RPCs by removing public from runtime search_path.
-- All referenced application objects in these function bodies are schema-qualified.
-- Keep EXECUTE grants unchanged: each RPC is intentionally used by the app and enforces its own authorization checks.
ALTER FUNCTION public.can_message(uuid, uuid) SET search_path = '';
ALTER FUNCTION public.is_active_group_member(uuid) SET search_path = '';
ALTER FUNCTION public.is_group_owner(uuid) SET search_path = '';
ALTER FUNCTION public.is_public_group(uuid) SET search_path = '';
ALTER FUNCTION public.review_verification_request(uuid, public.review_state, text) SET search_path = '';
