-- 진도 현황: 현재 교재 시작일(강사 직접 입력). 예상 진도율 계산의 최우선 시작일.
alter table public.class_progress add column if not exists main_started_on date;
comment on column public.class_progress.main_started_on is '현재 교재 시작일(강사 입력). 예상 진도율 시작일 1순위';
