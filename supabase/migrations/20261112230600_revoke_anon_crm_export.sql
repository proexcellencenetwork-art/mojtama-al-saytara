revoke all on function public.get_owner_crm_export() from anon;
revoke all on function public.get_owner_crm_export() from public;
grant execute on function public.get_owner_crm_export() to authenticated;