import type { Withdrawal } from "@/types";
import type { WithdrawalRetrospective } from "@/lib/withdrawal-retrospective";
import { EMPTY_RETROSPECTIVE } from "@/lib/withdrawal-retrospective";

let seq = 0;

/** 테스트용 Withdrawal 팩토리. 필요한 필드만 partial로 덮어쓴다. */
export function makeW(partial: Partial<Withdrawal> = {}): Withdrawal {
  seq += 1;
  return {
    id: `w-${seq}`,
    name: `학생${seq}`,
    school: null,
    subject: "수학",
    class_name: null,
    teacher: null,
    grade: null,
    enrollment_start: null,
    enrollment_end: null,
    notice_date: null,
    duration_months: null,
    withdrawal_date: "2026-03-10",
    class_attitude: null,
    homework_submission: null,
    attendance: null,
    grade_change: null,
    recent_grade: null,
    reason_category: null,
    student_opinion: null,
    parent_opinion: null,
    teacher_opinion: null,
    final_consult_date: null,
    final_counselor: null,
    final_consult_summary: null,
    parent_thanks: false,
    comeback_possibility: null,
    expected_comeback_date: null,
    special_notes: null,
    raw_text: null,
    retrospective: null,
    created_at: "2026-03-10T00:00:00.000Z",
    updated_at: "2026-03-10T00:00:00.000Z",
    ...partial,
  };
}

export function makeMany(count: number, partial: Partial<Withdrawal> = {}): Withdrawal[] {
  return Array.from({ length: count }, () => makeW(partial));
}

/** 완료된 회고를 만든다. lesson을 비우면 미완료(draft) 상태가 된다. */
export function makeRetro(
  partial: Partial<WithdrawalRetrospective> = {}
): WithdrawalRetrospective {
  return {
    ...EMPTY_RETROSPECTIVE,
    first_sign: "숙제 미제출 증가",
    our_attempts: "면담 2회",
    do_differently: "조기 학부모 공유",
    system_change: "미제출 자동 알림",
    lesson: "징후는 숙제에서 먼저 보인다",
    author: "원장",
    ...partial,
  };
}
