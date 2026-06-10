-- 진도현황 v2: 반 특성 + 다음 교재 예정일 + 교재 이력 (2026-06-11 운영 적용 완료)
alter table public.class_progress
  add column if not exists ability_level text,    -- 학습능력: 상/중/하
  add column if not exists study_intensity text,  -- 학습강도: 상/중/하
  add column if not exists homework_volume text,  -- 학습량(숙제): 상/중/하
  add column if not exists class_pace text,       -- 진도속도: 빠름/보통/느림
  add column if not exists next_start_date date;  -- 다음 교재 시작 예정일

create table if not exists public.class_textbook_history (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  textbook text not null,
  started_on date,
  finished_on date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_textbook_history_class
  on public.class_textbook_history (class_id, finished_on desc);

alter table public.class_textbook_history enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='class_textbook_history' and policyname='textbook_history_all_authenticated') then
    create policy "textbook_history_all_authenticated" on public.class_textbook_history
      for all to authenticated using (true) with check (true);
  end if;
end $$;
