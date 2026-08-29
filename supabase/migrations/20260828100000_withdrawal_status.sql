-- 퇴원 상태(status) + 복귀 확정일(returned_at) 컬럼 추가
--
-- File only: 자동 적용되지 않는다. 적용은 Supabase SQL Editor에서 수동 실행.
--
-- 배경
--   지금까지 withdrawals에 담긴 건은 전부 '퇴원'으로만 취급했다.
--   실제로는 휴원(복귀 예정)·복귀가 섞여 있어 퇴원 통계가 부풀려진다.
--   status로 셋을 갈라, 퇴원 통계는 status='withdrawn'만 세도록 한다.
--
-- 백필 없음
--   기본값이 'withdrawn'이라 기존 전건이 자동으로 '퇴원'이 된다.
--   즉 적용 직후 화면 숫자는 변하지 않는다.
--   기존 휴원성 4건은 배포 후 직원이 화면에서 직접 전환한다.
--   (누가 휴원인지 SQL로 추측해서 바꾸지 않는다)

alter table public.withdrawals
  add column if not exists status text not null default 'withdrawn';

alter table public.withdrawals
  add column if not exists returned_at date;

-- 체크 제약은 재실행 가능하도록 이름을 정해 두고 먼저 지운다.
alter table public.withdrawals
  drop constraint if exists withdrawals_status_check;

alter table public.withdrawals
  add constraint withdrawals_status_check
  check (status in ('withdrawn', 'paused', 'returned'));

comment on column public.withdrawals.status is
  '퇴원 상태 — withdrawn(퇴원) / paused(휴원, 복귀 예정) / returned(복귀). 퇴원 통계는 withdrawn만 센다.';

comment on column public.withdrawals.returned_at is
  '복귀 확정일 — status=returned 일 때만 채운다.';

-- 목록·통계가 상태로 자주 걸러지므로 인덱스를 하나 둔다.
create index if not exists idx_withdrawals_status on public.withdrawals(status);
