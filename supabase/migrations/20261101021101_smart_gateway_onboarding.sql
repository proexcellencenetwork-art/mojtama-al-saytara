-- Reconstructed from the live Supabase schema after the onboarding gateway
-- was applied directly to production and its original SQL file was not committed.
-- Private intake tables: service_role only; RLS is enabled with no client policies.

create table if not exists public.onboarding_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  specialty text not null,
  goal text not null,
  selected_paths text[] not null default '{}'::text[],
  processing_consent_at timestamptz not null,
  privacy_notice_version text not null,
  marketing_opt_in boolean not null default false,
  marketing_consent_at timestamptz,
  source_path text not null default '/',
  status text not null default 'new',
  converted_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_leads_email_check check (char_length(email) between 5 and 254),
  constraint onboarding_leads_full_name_check check (char_length(full_name) between 2 and 100),
  constraint onboarding_leads_specialty_check check (char_length(specialty) between 1 and 100),
  constraint onboarding_leads_goal_check check (goal in ('job','skills','promotion','transition','leadership','explore')),
  constraint onboarding_leads_status_check check (status in ('new','contacted','qualified','archived')),
  constraint onboarding_marketing_consent_consistent check (
    (marketing_opt_in = false and marketing_consent_at is null)
    or (marketing_opt_in = true and marketing_consent_at is not null)
  )
);

create table if not exists public.onboarding_interest_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.onboarding_leads(id) on delete cascade,
  interest_key text not null,
  source_page text not null default '/',
  created_at timestamptz not null default now(),
  constraint onboarding_interest_events_interest_key_check check (char_length(interest_key) between 1 and 80)
);

create table if not exists public.onboarding_rate_limits (
  fingerprint text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint onboarding_rate_limits_request_count_check check (request_count between 1 and 5)
);

create index if not exists onboarding_leads_created_at_idx on public.onboarding_leads (created_at desc);
create index if not exists onboarding_leads_email_lower_idx on public.onboarding_leads (lower(email));
create index if not exists onboarding_leads_goal_idx on public.onboarding_leads (goal);
create index if not exists onboarding_interest_events_interest_idx on public.onboarding_interest_events (interest_key, created_at desc);
create index if not exists onboarding_interest_events_lead_idx on public.onboarding_interest_events (lead_id);

alter table public.onboarding_leads enable row level security;
alter table public.onboarding_interest_events enable row level security;
alter table public.onboarding_rate_limits enable row level security;

revoke all on table public.onboarding_leads, public.onboarding_interest_events, public.onboarding_rate_limits from public, anon, authenticated;
grant all on table public.onboarding_leads, public.onboarding_interest_events, public.onboarding_rate_limits to service_role;

comment on table public.onboarding_leads is 'Private early-interest requests. Access only through trusted server-side workflows.';
comment on table public.onboarding_interest_events is 'Private interest signals linked to onboarding leads. Access only through trusted server-side workflows.';
comment on table public.onboarding_rate_limits is 'Hashed request fingerprints for onboarding abuse prevention. Access only through trusted server-side workflows.';
