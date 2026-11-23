-- Professional portfolio records are owned by the member and private by default.
-- This table intentionally contains no certificate, attachment, proof, evidence, or external-link fields.
begin;

create table if not exists public.professional_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('project','solved_problem','skill','result')),
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text not null check (char_length(btrim(description)) between 2 and 1200),
  result_summary text not null default '' check (char_length(result_summary) <= 1000),
  metric_value numeric(14,3) check (metric_value is null or metric_value >= 0),
  metric_unit text not null default '' check (char_length(metric_unit) <= 32),
  period_label text not null default '' check (char_length(period_label) <= 60),
  visibility text not null default 'private' check (visibility in ('private','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_portfolio_metric_unit_pair
    check ((metric_value is null and metric_unit = '') or
           (metric_value is not null and char_length(btrim(metric_unit)) between 1 and 32))
);

create index if not exists professional_portfolio_items_owner_created_idx
  on public.professional_portfolio_items (user_id, created_at desc);

create index if not exists professional_portfolio_items_public_owner_idx
  on public.professional_portfolio_items (user_id, item_type, created_at desc)
  where visibility = 'public';

drop trigger if exists professional_portfolio_items_updated on public.professional_portfolio_items;
create trigger professional_portfolio_items_updated
before update on public.professional_portfolio_items
for each row execute procedure public.set_updated_at();

alter table public.professional_portfolio_items enable row level security;

drop policy if exists "Approved members manage their own portfolio" on public.professional_portfolio_items;
create policy "Approved members manage their own portfolio"
on public.professional_portfolio_items
for all to authenticated
using (user_id = auth.uid() and public.is_account_approved())
with check (user_id = auth.uid() and public.is_account_approved());

drop policy if exists "Anyone reads explicitly public portfolio items" on public.professional_portfolio_items;
create policy "Anyone reads explicitly public portfolio items"
on public.professional_portfolio_items
for select to anon, authenticated
using (
  visibility = 'public'
  and exists (
    select 1
    from public.profiles p
    where p.user_id = professional_portfolio_items.user_id
      and p.account_status = 'approved'
      and p.visibility = 'public'
  )
);

revoke all on table public.professional_portfolio_items from anon, authenticated;
grant select on table public.professional_portfolio_items to anon, authenticated;
grant insert, update, delete on table public.professional_portfolio_items to authenticated;

comment on table public.professional_portfolio_items is
  'Member-owned professional portfolio cards. Private by default; public reads require an approved, public profile. No proof uploads, certificates, attachments, or external evidence links.';

commit;
