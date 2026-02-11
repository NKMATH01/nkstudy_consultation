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
  analysis_id: string | null;
  registration_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Class {
  id: string;
  name: string;
  teacher: string | null;
  target_grade: string | null;
  class_days: string | null;
  class_time: string | null;
  clinic_time: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Teacher {
  id: string;
  name: string;
  subject: string | null;
  target_grade: string | null;
  phone: string | null;
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
  q1: number | null; q2: number | null; q3: number | null; q4: number | null; q5: number | null;
  q6: number | null; q7: number | null; q8: number | null; q9: number | null; q10: number | null;
  q11: number | null; q12: number | null; q13: number | null; q14: number | null; q15: number | null;
  q16: number | null; q17: number | null; q18: number | null; q19: number | null; q20: number | null;
  q21: number | null; q22: number | null; q23: number | null; q24: number | null; q25: number | null;
  q26: number | null; q27: number | null; q28: number | null; q29: number | null; q30: number | null;
  study_core: string | null;
  problem_self: string | null;
  dream: string | null;
  prefer_days: string | null;
  requests: string | null;
  factor_attitude: number | null;
  factor_self_directed: number | null;
  factor_assignment: number | null;
  factor_willingness: number | null;
  factor_social: number | null;
  factor_management: number | null;
  analysis_id: string | null;
  created_at: string;
  updated_at: string;
}

// 6-Factor 매핑 (GAS 원본과 동일)
export const FACTOR_MAPPING: Record<string, number[]> = {
  attitude: [6, 7, 8, 9, 10],
  self_directed: [11, 14, 15, 18, 19],
  assignment: [12, 13, 16, 17],
  willingness: [21, 22, 23, 24, 25],
  social: [1, 2, 4, 5],
  management: [3, 20, 28, 30],
};

export const FACTOR_LABELS: Record<string, string> = {
  attitude: "수업태도",
  self_directed: "자기주도성",
  assignment: "과제수행력",
  willingness: "학업의지",
  social: "사회성",
  management: "관리선호",
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
  "나는 이해를 잘 시켜주는 선생님이 좋다",
  "나는 친절한 선생님이 좋다",
  "나는 상담을 많이 해주는 선생님이 좋다",
  "나는 재미있는 선생님이 좋다",
  "나는 강제적으로 공부하게 만드는 선생님이 좋다",
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
  comment_attitude: string | null;
  comment_self_directed: string | null;
  comment_assignment: string | null;
  comment_willingness: string | null;
  comment_social: string | null;
  comment_management: string | null;
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
  use_vehicle: string | null;
  test_score: string | null;
  test_note: string | null;
  location: string | null;
  consult_date: string | null;
  additional_note: string | null;
  tuition_fee: number | null;
  report_data: Record<string, unknown> | null;
  report_html: string | null;
  created_at: string;
  updated_at: string;
}

export const TUITION_TABLE: Record<string, number> = {
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

export const SCORE_FACTOR_KEYS = [
  "attitude",
  "self_directed",
  "assignment",
  "willingness",
  "social",
  "management",
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

// ==================== Constants ====================

export const GRADES = [
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
  hold: "보류",
  other: "기타",
};
