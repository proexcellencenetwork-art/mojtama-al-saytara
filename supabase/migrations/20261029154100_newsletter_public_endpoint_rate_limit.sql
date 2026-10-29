create table if not exists public.newsletter_rate_limits (
  fingerprint text primary key check (char_length(fingerprint)=64),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count between 1 and 100),
  updated_at timestamptz not null default now()
);
alter table public.newsletter_rate_limits enable row level security;
revoke all on public.newsletter_rate_limits from public, anon, authenticated;
grant all on public.newsletter_rate_limits to service_role;
revoke all on function public.request_newsletter_subscription(text,text) from public, anon, authenticated;
grant execute on function public.request_newsletter_subscription(text,text) to service_role;