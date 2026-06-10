-- 진도현황: 현재 교재 예상 기간 (예: 3개월 2주)
alter table public.class_progress
  add column if not exists expected_months integer,
  add column if not exists expected_weeks integer;
