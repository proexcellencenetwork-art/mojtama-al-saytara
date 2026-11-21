create table if not exists public.workshop_submissions (
  id uuid primary key default gen_random_uuid(),
  workshop_slug text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  problem text not null default '',
  desired_outcome text not null default '',
  personal_contribution text not null default '',
  evidence text not null default '',
  improvement_proposal text not null default '',
  responsibility_request text not null default '',
  baseline_value text not null default '',
  result_value text not null default '',
  metric_unit text not null default '',
  status text not null default 'draft' check (status in ('draft','submitted','reviewed')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshop_submissions_slug_check check (workshop_slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  constraint workshop_submissions_problem_len check (char_length(problem) <= 2000),
  constraint workshop_submissions_outcome_len check (char_length(desired_outcome) <= 1500),
  constraint workshop_submissions_contribution_len check (char_length(personal_contribution) <= 2000),
  constraint workshop_submissions_evidence_len check (char_length(evidence) <= 2000),
  constraint workshop_submissions_proposal_len check (char_length(improvement_proposal) <= 2000),
  constraint workshop_submissions_responsibility_len check (char_length(responsibility_request) <= 1500),
  constraint workshop_submissions_baseline_len check (char_length(baseline_value) <= 100),
  constraint workshop_submissions_result_len check (char_length(result_value) <= 100),
  constraint workshop_submissions_unit_len check (char_length(metric_unit) <= 60),
  constraint workshop_submissions_one_per_workshop_user unique (workshop_slug, user_id)
);
create index if not exists workshop_submissions_slug_status_idx
  on public.workshop_submissions (workshop_slug, status, submitted_at desc);
alter table public.workshop_submissions enable row level security;
revoke all on public.workshop_submissions from anon;
grant select, insert, update on public.workshop_submissions to authenticated;
drop policy if exists "Participants read their own workshop submission" on public.workshop_submissions;
create policy "Participants read their own workshop submission"
  on public.workshop_submissions for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Approved participants create their own workshop submission" on public.workshop_submissions;
create policy "Approved participants create their own workshop submission"
  on public.workshop_submissions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_account_approved() and status in ('draft','submitted'));
drop policy if exists "Participants update their own workshop submission" on public.workshop_submissions;
create policy "Participants update their own workshop submission"
  on public.workshop_submissions for update to authenticated
  using (user_id = (select auth.uid()) and public.is_account_approved())
  with check (user_id = (select auth.uid()) and public.is_account_approved() and status in ('draft','submitted'));
drop policy if exists "Facilitators read workshop submissions" on public.workshop_submissions;
create policy "Facilitators read workshop submissions"
  on public.workshop_submissions for select to authenticated
  using (
    public.is_platform_owner()
    or (
      public.is_account_approved()
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = (select auth.uid())
          and ur.role in ('coach'::public.app_role, 'manager'::public.app_role)
      )
    )
  );
