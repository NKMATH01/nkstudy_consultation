-- 퇴원 회고 카드: withdrawals에 retrospective JSONB 컬럼 추가.
-- 구조: {first_sign, our_attempts, do_differently, system_change, lesson,
--        manager_comment, author, completed_at}
-- File only: apply after user approval.

alter table public.withdrawals
  add column if not exists retrospective jsonb;

comment on column public.withdrawals.retrospective is
  '퇴원 회고: {first_sign, our_attempts, do_differently, system_change, lesson, manager_comment, author, completed_at}';
