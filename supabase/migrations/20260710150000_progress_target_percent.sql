-- 진도 목표율: 마감일(target_end_date)까지 완료할 목표 진도율(%)
alter table public.class_progress
  add column if not exists target_percent integer
  check (target_percent between 1 and 100);
