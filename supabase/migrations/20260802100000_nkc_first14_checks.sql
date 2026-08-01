-- 첫 14일 확인 루프: 설문 예측이 실제 수업에서 맞았는지 강사가 채점한 기록.
-- 강사 평가가 아니라 설문의 채점이다 — 'differed'가 쌓이면 문항을 고친다.
-- Do not add foreign keys to shared tables.
-- File only: apply after user approval.

create table if not exists public.nkc_first14_checks (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null,
  item_index int not null check (item_index between 1 and 3),
  item_text text not null,
  teacher text not null,
  result text not null check (result in ('matched', 'differed', 'unobserved')),
  note text,
  checked_at timestamptz default now(),
  constraint nkc_first14_checks_uniq unique (analysis_id, item_index)
);

create index if not exists idx_nkc_first14_checks_analysis
  on public.nkc_first14_checks (analysis_id);

alter table public.nkc_first14_checks enable row level security;

-- RLS는 authenticated 전체 허용이다(기존 nkc_ 테이블 관례).
-- 역할 구분(clinic 차단 등)은 서버 액션 게이트가 주 방어선이며,
-- auth.uid ↔ teachers actor 매핑이 들어오면 이 정책을 좁힌다.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nkc_first14_checks'
      and policyname = 'nkc_first14_checks_all_authenticated'
  ) then
    create policy "nkc_first14_checks_all_authenticated"
      on public.nkc_first14_checks
      for all to authenticated
      using (true)
      with check (true);
  end if;
end $$;
