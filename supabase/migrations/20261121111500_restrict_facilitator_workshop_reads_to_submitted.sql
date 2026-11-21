drop policy if exists "Facilitators read workshop submissions" on public.workshop_submissions;
create policy "Facilitators read submitted workshop submissions"
  on public.workshop_submissions for select to authenticated
  using (
    status in ('submitted','reviewed')
    and (
      public.is_platform_owner()
      or (
        public.is_account_approved()
        and exists (
          select 1 from public.user_roles ur
          where ur.user_id = (select auth.uid())
            and ur.role in ('coach'::public.app_role, 'manager'::public.app_role)
        )
      )
    )
  );
