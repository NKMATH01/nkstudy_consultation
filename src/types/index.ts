import type { WithdrawalRetrospective } from "@/lib/withdrawal-retrospective";

// ==================== Database Types ====================

export interface Profile {
  id: string;
  name: string;
  role: "admin" | "user";
  created_at: string;
  updated_at: string;
}

export type ConsultationStatus =
  | "active"
  | "completed"
  | "cancelled"
  | "pending";
export type BookingStatus = "active" | "cancelled";
export type ResultStatus = "none" | "registered" | "hold" | "other";

export interface Consultation {
  id: string;
  name: string;
  school: string | null;
  grade: string | null;
  parent_phone: string | null;
  consult_date: string | null;
  consult_time: string | null;
  subject: string | null;
  location: string | null;
  consult_type: string;
  status: ConsultationStatus;
  result_status: ResultStatus;
  memo: string | null;
  doc_sent: boolean;
  call_done: boolean;
  attitude: string | null;
  willingness: string | null;
  parent_level: string | null;
  requests: string | null;
  prev_academy: string | null;
  school_score: string | null;
  test_score: string | null;
  plan_date: string | null;
  plan_class: string | null;
  notify_sent: boolean;
  consult_done: boolean;
  prefer_days: string | null;
  student_level: string | null;
  reserve_text_sent: boolean;
  reserve_deposit: boolean;
  payment_type: string;
  prev_complaint: string | null;
  referral: string | null;
  has_friend: string | null;
  advance_level: string | null;
  study_goal: string | null;
  student_consult_note: string | null;
  parent_consult_note: string | null;
  parent_consult_date: string | null;
  parent_consult_time: string | null;
  parent_location: string | null;
  test_fee_paid: boolean;
  test_fee_method: string | null;
  booking_id: string | null;
  status_changed_at: string | null;
  cancel_reason: string | null;
  rescheduled_at: string | null;
  analysis_id: string | null;
  registration_id: string | null;
  student_id: string | null;
  decision_maker: string | null;
  follow_up_date: string | null;
  mock_exam_score: string | null;
  sibling_enrolled: string | null;
  parent_expectation: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Class {
  id: string;
  name: string;
  teacher: string | null;
  teacher_id?: string | null;
  target_grade: string | null;
  class_days: string | null;
  class_time: string | null;
  clinic_time: string | null;
  weekly_test_time: string | null;
  location: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassProgress {
  id: string;
  class_id: string;
  student_count: number | null;
  main_textbook: string | null;
  main_total_pages: number | null;
  current_page: number | null;
  sub_textbook: string | null;
  next_textbook: string | null;
  next_start_plan: string | null;
  current_plan: string | null;
  current_major_unit: string | null;
  current_minor_unit: string | null;
  note: string | null;
  ability_level: string | null;
  study_intensity: string | null;
  homework_volume: string | null;
  class_pace: string | null;
  next_start_date: string | null;
  expected_months: number | null;
  expected_weeks: number | null;
  target_end_date: string | null;
  target_percent: number | null;
  /** 현재 교재 시작일(강사 직접 입력) — 예상 진도율 계산의 1순위 시작일 */
  main_started_on: string | null;
  updated_by: string | null;
  progress_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TextbookHistory {
  id: string;
  class_id: string;
  textbook: string;
  started_on: string | null;
  finished_on: string | null;
  note: string | null;
  created_at: string;
}

export const CLASS_LEVELS = ["상", "중", "하"] as const;
export const CLASS_PACES = ["빠름", "보통", "느림"] as const;

// ==================== 수업 진행 단원 ====================

export interface CurriculumProgress {
  id: string;
  class_id: string;
  unit: string;
  level: string | null;   // 기본 | 응용 | 심화
  status: string;         // 진행중 | 완료
  note: string | null;
  created_at: string;
}

export const CURRICULUM_LEVELS = ["기본", "응용", "심화"] as const;
export const CURRICULUM_STATUS = ["진행중", "완료"] as const;

/** 단원 picker 그룹 (학교급별). 저장값은 unit 문자열 그대로. */
export const CURRICULUM_UNIT_GROUPS: { label: string; units: string[] }[] = [
  { label: "초등", units: ["초3-1", "초3-2", "초4-1", "초4-2", "초5-1", "초5-2", "초6-1", "초6-2"] },
  { label: "중등", units: ["중1-1", "중1-2", "중2-1", "중2-2", "중3-1", "중3-2"] },
  { label: "고1", units: ["공수1", "공수2"] },
  { label: "고2", units: ["대수", "미적분1"] },
  { label: "고3·선택", units: ["미적분2", "확률통계", "기하"] },
];

/** 정렬 기준이 되는 평탄한 단원 순서(canonical order). */
export const CURRICULUM_UNITS: string[] = CURRICULUM_UNIT_GROUPS.flatMap((g) => g.units);

/** 단원의 canonical 정렬 인덱스 (미등록 단원은 뒤로). */
export function curriculumUnitOrder(unit: string): number {
  const idx = CURRICULUM_UNITS.indexOf(unit);
  return idx === -1 ? CURRICULUM_UNITS.length : idx;
}

export interface ClassProgressLog {
  id: string;
  progress_id: string;
  page: number;
  recorded_by: string | null;
  recorded_at: string;
}

export interface Teacher {
  id: string;
  name: string;
  subject: string | null;
  target_grade: string | null;
  phone: string | null;
  role: "teacher" | "clinic" | "admin" | "director" | "principal" | "manager" | "staff" | null;
  password: string | null;
  password_changed: boolean;
  auth_user_id: string | null;
  active: boolean;
  allowed_menus: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CurrentTeacherInfo {
  name: string;
  role: string | null;
  phone: string | null;
  allowed_menus: string[] | null;
}

export const ALL_MENU_ITEMS = [
  { href: "/", label: "상담 및 등록 현황" },
  { href: "/consultations", label: "상담 관리" },
  { href: "/bookings", label: "예약 현황판" },
  { href: "/surveys", label: "설문 현황" },
  { href: "/analyses", label: "성향분석 결과" },
  { href: "/registrations", label: "등록 안내" },
  { href: "/onboarding", label: "신입생 등록" },
  { href: "/progress", label: "진도 현황" },
  { href: "/withdrawals", label: "퇴원생 현황" },
  { href: "/withdrawals/dashboard", label: "퇴원생 분석" },
  { href: "/withdrawals/review", label: "월간 반성 리포트" },
  { href: "/withdrawals/teachers", label: "강사 러닝 뷰" },
  { href: "/settings/students", label: "학생 관리" },
  { href: "/settings/classes", label: "반 관리" },
  { href: "/settings/teachers", label: "선생님 관리" },
  { href: "/settings/permissions", label: "선생님 권한" },
] as const;

export interface Student {
  id: string;
  name: string;
  school: string | null;
  grade: string | null;
  student_phone: string | null;
  parent_phone: string | null;
  assigned_class: string | null;
  teacher: string | null;
  memo: string | null;
  registration_date: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Survey {
  id: string;
  name: string;
  school: string | null;
  grade: string | null;
  student_phone: string | null;
  parent_phone: string | null;
  referral: string | null;
  prev_academy: string | null;
  prev_complaint: string | null;
  school_score: string | null;
  mock_exam_score: string | null;
  advance_level: string | null;
  target_university: string | null;
  weekly_study_hours: string | null;
  available_time: string | null;
  commute_method: string | null;
  commute_distance: string | null;
  sibling_enrolled: string | null;
  parent_expectation: string | null;
  mbti: string | null;
  health_note: string | null;
  q1: number | null; q2: number | null; q3: number | null; q4: number | null; q5: number | null;
  q6: number | null; q7: number | null; q8: number | null; q9: number | null; q10: number | null;
  q11: number | null; q12: number | null; q13: number | null; q14: number | null; q15: number | null;
  q16: number | null; q17: number | null; q18: number | null; q19: number | null; q20: number | null;
  q21: number | null; q22: number | null; q23: number | null; q24: number | null; q25: number | null;
  q26: number | null; q27: number | null; q28: number | null; q29: number | null; q30: number | null;
  q31: number | null; q32: number | null; q33: number | null; q34: number | null; q35: number | null;
  study_core: string | null;
  problem_self: string | null;
  dream: string | null;
  prefer_days: string | null;
  requests: string | null;
  math_difficulty: string | null;
  english_difficulty: string | null;
  factor_attitude: number | null;
  factor_self_directed: number | null;
  factor_assignment: number | null;
  factor_willingness: number | null;
  factor_social: number | null;
  factor_management: number | null;
  factor_emotion: number | null;
  analysis_id: string | null;
  // ── 설문 V2 (learning profile, versioned JSONB) ──
  // V1 행에서는 모두 null. instrument_version='v2'만 V2 제출을 뜻한다.
  instrument_version?: string | null;
  subject_selection?: import("@/lib/assessment/v2/types").SubjectSelection | null;
  intake_v2?: import("@/lib/assessment/v2/types").StoredIntakeV2 | null;
  responses_v2?: import("@/lib/assessment/v2/types").StoredResponsesV2 | null;
  response_meta_v2?: import("@/lib/assessment/v2/types").StoredResponseMetaV2 | null;
  score_profile_v2?: import("@/lib/assessment/v2/types").ScoreProfile | null;
  created_at: string;
  updated_at: string;
}

// 7-Factor 매핑
export const FACTOR_MAPPING: Record<string, number[]> = {
  attitude: [6, 7, 8, 9, 10],
  self_directed: [11, 14, 15, 18, 19, 29],
  assignment: [12, 13, 16, 17, 34, 35],
  willingness: [21, 22, 23, 24, 25],
  social: [1, 2, 4, 5],
  management: [3, 20, 28, 30],
  emotion: [26, 27, 31, 32, 33],
};

export const FACTOR_LABELS: Record<string, string> = {
  attitude: "수업태도",
  self_directed: "자기주도성",
  assignment: "과제수행력",
  willingness: "학업의지",
  social: "사회성",
  management: "관리선호",
  emotion: "심리·자신감",
};

export const SURVEY_QUESTIONS: string[] = [
  "나는 적극적이고 활발한 성격이다",
  "나는 새로운 환경에 금방 적응한다",
  "나는 상담을 자주 해줬으면 좋겠다",
  "나는 친구가 많은 학원이 좋다",
  "나는 친구 관계와 학업의 균형을 잘 맞출 수 있다",
  "나는 수업에 집중을 하여 수업을 잘 듣는 편이다",
  "나는 수업중에 핵심내용을 놓치지 않기 위하여 필기를 하며 수업을 듣는다",
  "나는 수업시간에 절대 졸지 않는다",
  "나는 수업시간에 지각하지 않는다",
  "나는 수업시간에 이해도가 빠른 편이다",
  "나는 스스로 공부하는 시간이 많다(숙제 제외)",
  "나는 숙제를 열심히 한다",
  "나는 예습과 복습 모두 중요하게 생각한다",
  "나는 스스로 계획을 세워서 공부한다",
  "나는 공간(집, 독서실, 학원)에 상관없이 열심히 공부한다",
  "나는 숙제는 반드시 정해진 시간에 제출한다",
  "나는 숙제를 꼼꼼하고 정성껏 하는 편이다",
  "나는 모르는 문제는 스스로 많은 고민을 하고 푼다",
  "나는 스스로 문제를 10분정도는 고민한 후 다른 풀이를 참고한다",
  "나는 숙제가 많은 것이 좋다",
  "나는 NK학원에 꼭 다니고 싶다",
  "나는 힘들어도 공부를 시켜주는 학원을 가고 싶다",
  "나는 어려워도 쉽게 포기하지 않는다",
  "나는 꼭 공부를 잘하고 싶다",
  "나는 진짜 공부를 열심히 해 볼 생각이다",
  "나는 시험을 볼 때 긴장하지 않고 실력을 잘 발휘한다",
  "나는 선생님이 엄하게 지도해도 의욕이 떨어지지 않는다",
  "나는 상담을 많이 해주는 선생님이 좋다",
  "나는 공부할 때 핸드폰을 멀리 두는 편이다",
  "나는 강제적으로 공부하게 만드는 선생님이 좋다",
  "나는 수학을 잘할 수 있다고 생각한다",
  "나는 영어를 잘할 수 있다고 생각한다",
  "나는 아는 문제를 시험에서 실수 없이 잘 푸는 편이다",
  "나는 영어 단어를 꾸준히 외우는 편이다",
  "나는 수학 공식이나 풀이 과정을 정리하는 편이다",
];

export interface Analysis {
  id: string;
  survey_id: string | null;
  name: string;
  school: string | null;
  grade: string | null;
  score_attitude: number | null;
  score_self_directed: number | null;
  score_assignment: number | null;
  score_willingness: number | null;
  score_social: number | null;
  score_management: number | null;
  score_emotion: number | null;
  comment_attitude: string | null;
  comment_self_directed: string | null;
  comment_assignment: string | null;
  comment_willingness: string | null;
  comment_social: string | null;
  comment_management: string | null;
  comment_emotion: string | null;
  student_type: string | null;
  summary: string | null;
  strengths: { title: string; description: string }[];
  weaknesses: { title: string; description: string }[];
  paradox: Record<string, unknown>[];
  solutions: { step: number; weeks: string; goal: string; actions: string[] }[];
  final_assessment: string | null;
  report_html: string | null;
  created_at: string;
  updated_at: string;
  // 설문 V2(학습 프로필) 분석. V1 분석에서는 null.
  analysis_version?: string | null;
  result_profile_v2?: import("@/lib/assessment/v2/interpretation").ResultProfileV2 | null;
  response_quality_v2?: import("@/lib/assessment/v2/types").ResponseQuality | null;
}

export interface Registration {
  id: string;
  analysis_id: string | null;
  name: string;
  school: string | null;
  grade: string | null;
  student_phone: string | null;
  parent_phone: string | null;
  registration_date: string | null;
  assigned_class: string | null;
  teacher: string | null;
  assigned_class_2: string | null;
  teacher_2: string | null;
  assigned_class_math2: string | null;
  teacher_math2: string | null;
  subject: string | null;
  preferred_days: string | null;
  use_vehicle: string | null;
  test_score: string | null;
  test_note: string | null;
  school_score: string | null;
  location: string | null;
  location_math2: string | null;
  location_2: string | null;
  consult_date: string | null;
  additional_note: string | null;
  tuition_fee: number | null;
  onboarding_status: string | null;
  report_data: Record<string, unknown> | null;
  report_html: string | null;
  created_at: string;
  updated_at: string;
}

export const TUITION_TABLE: Record<string, number> = {
  "초3": 280000,
  "초4": 300000,
  "초5": 300000,
  "초6": 320000,
  "중1": 320000,
  "중2": 350000,
  "중3": 350000,
  "고1": 380000,
  "고2": 400000,
  "고3": 400000,
};

// 2과목(영어수학) 할인: 중등부 5만원, 고등부 3만원
export function getTuitionWithDiscount(grade: string, subject: string): number {
  const base = TUITION_TABLE[grade] || 0;
  if (subject !== "영어수학") return base;
  // 고등부
  if (grade.startsWith("고")) return base - 30000;
  // 중등부 (초6~중3)
  if (["초6", "중1", "중2", "중3"].includes(grade)) return base - 50000;
  return base;
}

export const SCORE_FACTOR_KEYS = [
  "attitude",
  "self_directed",
  "assignment",
  "willingness",
  "social",
  "management",
  "emotion",
] as const;

// ==================== API Types ====================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ConsultationFilters {
  startDate?: string;
  endDate?: string;
  status?: ConsultationStatus;
  search?: string;
  page?: number;
  limit?: number;
}

// ==================== Form Types ====================

export interface ConsultationFormData {
  name: string;
  school?: string;
  grade?: string;
  parentPhone?: string;
  consultDate?: string;
  consultTime?: string;
  subject?: string;
  location?: string;
  consultType?: string;
  memo?: string;
}

// ==================== Withdrawal Types ====================

export type WithdrawalAttitude = "상" | "중상" | "중" | "중하" | "하";
export type GradeChange = "상승" | "유지" | "하락";
export type ComebackPossibility = "상" | "중상" | "중" | "중하" | "하" | "최하";

export const WITHDRAWAL_REASONS = [
  "성적 부진",
  "학습 의지 및 태도",
  "학습량 부담",
  "학습 관리 및 시스템",
  "수업 내용 및 방식",
  "강사 역량 및 소통",
  "타 학원/과외로 이동",
  "친구 문제",
  "스케줄 변동",
  "개인 사유",
  "기타",
] as const;

/** 퇴원 기록의 상태. 퇴원 통계는 withdrawn만 센다. */
export type WithdrawalStatusValue = "withdrawn" | "paused" | "returned";

/** 퇴원 상태 한국어 라벨. 상담용 STATUS_LABELS와는 별개 상수다. */
export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatusValue, string> = {
  withdrawn: "퇴원",
  paused: "휴원",
  returned: "복귀",
};

export interface Withdrawal {
  id: string;
  name: string;
  school: string | null;
  subject: string | null;
  class_name: string | null;
  teacher: string | null;
  grade: string | null;
  enrollment_start: string | null;
  /** @deprecated 폼에서 내려간 레거시 칸. 과거 기록 보존용으로만 남는다. */
  enrollment_end: string | null;
  /** 퇴원 인지일 — 학원이 퇴원 사실을 알게 된 날. 퇴원일(마지막 등원일)과 구분한다. */
  notice_date: string | null;
  duration_months: number | null;
  /** 퇴원일 = 마지막 등원일. */
  withdrawal_date: string | null;
  /** 퇴원/휴원/복귀. 컬럼 도입 이전 기록은 서버에서 withdrawn으로 채워 내려온다. */
  status: WithdrawalStatusValue;
  /** 복귀 확정일. status='returned' 일 때만 값이 있다. */
  returned_at: string | null;
  class_attitude: string | null;
  homework_submission: string | null;
  attendance: string | null;
  grade_change: string | null;
  recent_grade: string | null;
  reason_category: string | null;
  student_opinion: string | null;
  parent_opinion: string | null;
  teacher_opinion: string | null;
  final_consult_date: string | null;
  final_counselor: string | null;
  final_consult_summary: string | null;
  parent_thanks: boolean;
  comeback_possibility: string | null;
  expected_comeback_date: string | null;
  special_notes: string | null;
  raw_text: string | null;
  retrospective: WithdrawalRetrospective | null;
  created_at: string;
  updated_at: string;
}

// ==================== Constants ====================

export const GRADES = [
  "초3",
  "초4",
  "초5",
  "초6",
  "중1",
  "중2",
  "중3",
  "고1",
  "고2",
  "고3",
] as const;

export const SUBJECTS = ["수학", "영어", "영어수학"] as const;
export const PREFERRED_DAYS = ["월수금", "화목금", "화목토", "상관없음"] as const;

export const CONSULT_TYPES = ["유선 상담", "대면 상담"] as const;

export const LOCATIONS = [
  "NK학원(폴리타운 B동 4층)",
  "NK학원(폴리타운 A동 7층)",
  "자이센터프라자 801호",
] as const;

export const STATUS_LABELS: Record<ConsultationStatus, string> = {
  active: "진행중",
  completed: "완료",
  cancelled: "취소",
  pending: "대기",
};

export const RESULT_STATUS_LABELS: Record<ResultStatus, string> = {
  none: "-",
  registered: "등록",
  hold: "고민중",
  other: "미등록",
};

// ==================== Booking Types ====================

export interface Booking {
  id: string;
  branch: string;
  consult_type: string;
  booking_date: string;
  booking_hour: number;
  student_name: string;
  parent_name: string;
  phone: string;
  school: string | null;
  grade: string | null;
  subject: string | null;
  progress: string | null;
  paid: boolean;
  pay_method: string | null;
  status: BookingStatus;
  status_changed_at: string | null;
  cancel_reason: string | null;
  rescheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsultationEvent {
  id: string;
  booking_id: string | null;
  consultation_id: string | null;
  event_type:
    | "cancelled"
    | "rescheduled"
    | "reactivated"
    | "status_changed"
    | "deleted";
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  created_by_label: string | null;
  created_at: string;
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  active: "진행",
  cancelled: "취소됨",
};

export const RESCHEDULED_LABEL = "시간변경";

export interface BlockedSlot {
  id: string;
  slot_date: string;
  slot_hour: number;
  branch: string;
  created_at: string;
}

export const BRANCHES = [
  { id: "gojan-math", label: "고잔점(수학)", icon: "∑", color: "#0ea5e9" },
  { id: "gojan-eng", label: "고잔점(영어)", icon: "Aa", color: "#8b5cf6" },
  { id: "zai-both", label: "자이점(영수)", icon: "∞", color: "#f59e0b" },
] as const;

export const BOOKING_SUBJECTS = [
  { id: "math", label: "수학", icon: "∑" },
  { id: "eng", label: "영어", icon: "Aa" },
  { id: "both", label: "영수", icon: "∑+Aa" },
] as const;

export const BOOKING_GRADES = [
  "초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3",
] as const;
