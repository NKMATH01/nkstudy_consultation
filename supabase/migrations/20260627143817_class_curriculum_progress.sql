-- 진도현황: 수업 진행 단원 이력 (단원 + 기본/응용/심화 + 진행중/완료)
-- 이 앱 전용 테이블. 공유 테이블(classes/students/teachers)은 건드리지 않음.
-- class_textbook_history 패턴을 그대로 따름.

create table if not exists public.class_curriculum_progress (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  unit text not null,                    -- 정규 토큰: 초5-2 / 중3-1 / 공수1 / 대수 / 미적분2 / 확률통계 / 기하
  level text,                            -- 기본 | 응용 | 심화 (nullable)
  status text not null default '진행중',  -- 진행중 | 완료
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, unit)                -- 같은 반·같은 단원은 1행(재추가 시 갱신)
);

create index if not exists idx_curriculum_progress_class
  on public.class_curriculum_progress (class_id);

alter table public.class_curriculum_progress enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'class_curriculum_progress'
      and policyname = 'curriculum_progress_all_authenticated'
  ) then
    create policy "curriculum_progress_all_authenticated" on public.class_curriculum_progress
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- updated_at 자동 갱신: 기존 트리거 함수 재사용
drop trigger if exists update_curriculum_progress_updated_at on public.class_curriculum_progress;
create trigger update_curriculum_progress_updated_at
  before update on public.class_curriculum_progress
  for each row execute function public.update_class_progress_updated_at();
