-- 퇴원 인지일(notice_date) 컬럼 추가 + enrollment_end 백필
--
-- File only: 자동 적용되지 않는다. 적용은 Supabase SQL Editor에서 수동 실행.
--
-- 배경
--   퇴원 폼의 '퇴원인지일' 입력이 라벨과 달리 enrollment_end 칸에 저장돼 왔다.
--   대표 결정으로 퇴원일(withdrawal_date) = 마지막 등원일이 확정되면서
--   '학원이 퇴원 사실을 알게 된 날'은 별도 컬럼(notice_date)으로 분리한다.
--   enrollment_end 원본은 지우지 않고 그대로 보존한다(과거 기록 보존 + 롤백 여지).
--
-- 컬럼 타입 확인 결과
--   supabase/legacy/withdrawals.sql, supabase/legacy/insert_withdrawals.sql 기준
--   enrollment_start / enrollment_end / withdrawal_date 는 모두 TEXT.
--   (withdrawals 테이블은 supabase/legacy/schema.sql 에는 없고 위 두 파일에만 정의돼 있다)
--   따라서 백필은 text → date 안전 캐스팅으로 처리한다.

alter table public.withdrawals
  add column if not exists notice_date date;

comment on column public.withdrawals.notice_date is
  '퇴원 인지일 — 학원이 퇴원 사실을 알게 된 날. 퇴원일(withdrawal_date, 마지막 등원일)과 구분한다.';

-- 백필: enrollment_end(text)가 '완전한 날짜'일 때만 notice_date로 복사한다.
--   1) 공백 제거 후 점·슬래시를 하이픈으로 정규화 ("2026.01.15" → "2026-01-15")
--   2) YYYY-MM-DD 형태이면서 월 01~12 / 일 01~31 범위인 값만 통과
--      → "2026.01"(월만), "01.29"(연도 없음), "2026-01-15 (10개월)" 등은 자동 제외
--   3) to_date 왕복 비교로 2026-02-30 같이 실재하지 않는 날짜를 최종 제외
--   위 세 단계로 캐스팅 예외가 발생할 수 없으므로 마이그레이션이 에러로 중단되지 않는다.
update public.withdrawals as w
set notice_date = to_date(n.normalized, 'YYYY-MM-DD')
from (
  select
    id,
    replace(replace(replace(enrollment_end, ' ', ''), '.', '-'), '/', '-') as normalized
  from public.withdrawals
  where enrollment_end is not null
) as n
where w.id = n.id
  and w.notice_date is null
  and n.normalized ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
  and to_char(to_date(n.normalized, 'YYYY-MM-DD'), 'YYYY-MM-DD') = n.normalized;
