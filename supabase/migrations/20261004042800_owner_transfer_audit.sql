-- Allow the single-owner transfer operation to be recorded with an accurate audit action.
BEGIN;

ALTER TABLE public.platform_owner_audit
  DROP CONSTRAINT IF EXISTS platform_owner_audit_action_check;

ALTER TABLE public.platform_owner_audit
  ADD CONSTRAINT platform_owner_audit_action_check
  CHECK (action IN (
    'owner_bootstrap',
    'owner_transferred',
    'role_granted',
    'role_revoked',
    'setting_changed',
    'account_suspended',
    'account_restored'
  ));

COMMIT;
