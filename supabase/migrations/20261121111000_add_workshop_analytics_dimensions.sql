alter table public.workshop_submissions
  add column if not exists problem_category text not null default 'other',
  add column if not exists impact_area text not null default 'other',
  add column if not exists outcome_type text not null default 'quality',
  add column if not exists baseline_number numeric,
  add column if not exists result_number numeric,
  add column if not exists measurement_unit text not null default '';

alter table public.workshop_submissions
  add constraint workshop_problem_category_check check (problem_category in ('process','communication','quality','time','customer','team','other')),
  add constraint workshop_impact_area_check check (impact_area in ('operations','service','quality','cost','time','experience','team','other')),
  add constraint workshop_outcome_type_check check (outcome_type in ('reduce','increase','improve','prevent','standardize','other'));

create index if not exists workshop_submissions_category_idx
  on public.workshop_submissions (workshop_slug, problem_category, impact_area);
