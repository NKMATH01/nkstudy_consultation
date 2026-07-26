-- 개선 액션 추적 루프: 대시보드 처방 채택 + 수동 액션.
-- Do not add foreign keys to shared tables.
-- File only: apply after user approval.

create table if not exists public.nkc_improvement_actions (
  id uuid primary key default gen_random_uuid(),
  year_month text not null,
  action_text text not null,
  source text not null default 'manual',
  source_title text,
  owner text,
  status text not null default 'pending' check (status in ('pending', 'done', 'dropped')),
  done_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint nkc_improvement_actions_uniq unique (year_month, action_text)
);

create index if not exists idx_nkc_improvement_actions_year_month
  on public.nkc_improvement_actions (year_month);

alter table public.nkc_improvement_actions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nkc_improvement_actions'
      and policyname = 'nkc_improvement_actions_all_authenticated'
  ) then
    create policy "nkc_improvement_actions_all_authenticated"
      on public.nkc_improvement_actions
      for all to authenticated
      using (true)
      with check (true);
  end if;
end $$;
