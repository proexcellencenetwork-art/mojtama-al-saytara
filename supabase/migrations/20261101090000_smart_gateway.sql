-- Smart Gateway: private visitor-interest capture with no public table access.
create table if not exists public.onboarding_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 100),
  email text not null check (char_length(email) between 5 and 254),
  specialty text not null check (char_length(specialty) between 1 and 100),
  goal text not null check (goal in ('job','skills','promotion','transition','leadership','explore')),
  selected_paths text[] not null default '{}',
  processing_consent_at timestamptz not null,
  privacy_notice_version text not null,
  marketing_opt_in boolean not null default false,
  marketing_consent_at timestamptz,
  source_path text not null default '/',
  status text not null default 'new' check (status in ('new','contacted','qualified','archived')),
  converted_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_marketing_consent_consistent check (
    (marketing_opt_in = false and marketing_consent_at is null) or
    (marketing_opt_in = true and marketing_consent_at is not null)
  )
);

create index if not exists onboarding_leads_created_at_idx on public.onboarding_leads (created_at desc);
create index if not exists onboarding_leads_goal_idx on public.onboarding_leads (goal);
create index if not exists onboarding_leads_email_lower_idx on public.onboarding_leads (lower(email));

create table if not exists public.onboarding_interest_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.onboarding_leads(id) on delete cascade,
  interest_key text not null check (char_length(interest_key) between 1 and 80),
  source_page text not null default '/',
  created_at timestamptz not null default now()
);
create index if not exists onboarding_interest_events_interest_idx on public.onboarding_interest_events (interest_key, created_at desc);
create index if not exists onboarding_interest_events_lead_idx on public.onboarding_interest_events (lead_id);

create table if not exists public.onboarding_rate_limits (
  fingerprint text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count between 1 and 5),
  updated_at timestamptz not null default now()
);

alter table public.onboarding_leads enable row level security;
alter table public.onboarding_interest_events enable row level security;
alter table public.onboarding_rate_limits enable row level security;

revoke all on public.onboarding_leads from anon, authenticated;
revoke all on public.onboarding_interest_events from anon, authenticated;
revoke all on public.onboarding_rate_limits from anon, authenticated;
grant all on public.onboarding_leads to service_role;
grant all on public.onboarding_interest_events to service_role;
grant all on public.onboarding_rate_limits to service_role;

comment on table public.onboarding_leads is 'Private visitor onboarding requests. Accessible only through trusted server-side workflows.';
comment on table public.onboarding_interest_events is 'Private onboarding interest signals; do not store raw contact details here.';
comment on table public.onboarding_rate_limits is 'Hashed request fingerprints for onboarding anti-abuse limits.';
