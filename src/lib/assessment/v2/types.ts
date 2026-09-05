// 설문 V2 학습 프로필 타입 정의.
// 이 모듈은 순수 타입만 포함하며 런타임 로직을 두지 않는다.
//
// v2.3(2026-09-04): 결과지가 답해야 할 질문 아홉 개에 척도 하나씩 대응하도록 구인을 다시 짰다.
// 문항표: docs/assessment-v2.3-blueprint-2026-09-04.md

export type Scale = "frequency" | "agreement" | "fit";
export type Direction = "positive" | "reverse";
export type Subject = "common" | "math" | "english";
export type SubjectSelection = "math" | "english" | "both";

/**
 * Likert 문항이 기여하는 점수 축(composite).
 *
 * 공통 아홉 척도(결과지 질문 1:1):
 *   learningAttitude 학습 태도 · homeworkReliability 숙제 태도 · goalClarity 목표 의식 ·
 *   shortTermRecovery 단기 회복력 · managementAcceptance 관리 수용 · coachingResponse 지도 방식 반응 ·
 *   questionInitiative 질문 성향 · phoneBoundary 휴대폰 조절 · peerFocusBoundary 친구와 있을 때 조절
 * coachingChoice 는 강제선택 CR5 전용(점수 합산 없음).
 */
export type Construct =
  | "learningAttitude"
  | "homeworkReliability"
  | "goalClarity"
  | "shortTermRecovery"
  | "managementAcceptance"
  | "coachingResponse"
  | "coachingChoice"
  | "questionInitiative"
  | "phoneBoundary"
  | "peerFocusBoundary"
  | "mathStrategy"
  | "mathNoveltyAvoidance"
  | "mathTestInterference"
  | "englishStrategy"
  | "englishReadingAvoidance"
  | "englishTestInterference";

/** 결과지에 공통 척도로 보이는 아홉 구인(강제선택·과목 제외). */
export type CommonConstruct =
  | "learningAttitude"
  | "homeworkReliability"
  | "goalClarity"
  | "shortTermRecovery"
  | "managementAcceptance"
  | "coachingResponse"
  | "questionInitiative"
  | "phoneBoundary"
  | "peerFocusBoundary";

export interface SupplementField {
  id: string;
  label: string;
  options: string[];
}

export interface Supplement {
  title: string;
  fields: SupplementField[];
}

/** 빈도 문항의 회상 기간. 기본은 최근 2주, 경험 문항은 "지금까지". */
export type RecallWindow = "twoWeeks" | "ever";

export interface LikertItem {
  id: string;
  kind: "likert";
  subject: Subject;
  construct: Construct;
  scale: Scale;
  /** "reverse"면 8.1 역채점 공식을 적용한다. */
  direction: Direction;
  /** 같은 composite 내 가중치. 명세상 별도 지정이 없으면 1. */
  weight: number;
  /** 제출 validation에서 필수 응답 여부. */
  required: boolean;
  /** "그런 경험이 없거나 잘 모르겠음"(unknown/not_applicable) 선택을 허용하는지. */
  allowUnknown: boolean;
  /** 회상 기간 안내. 생략하면 최근 2주. */
  recall?: RecallWindow;
  text: string;
  /** 결과지 그래프·강사 시트에 쓰는 짧은 라벨. */
  evidenceLabel: string;
  /** 생활 맥락 보조 입력. 점수에 반영하지 않는다(v2.3 문항에는 없음, 저장 데이터 표시용). */
  supplement?: Supplement;
}

export interface ScenarioOption {
  /** 1-based 선택지 번호. */
  index: number;
  /** "A" | "B" | "C" | "D" */
  choice: string;
  text: string;
  /** 8.7.3 선택지별 semantic evidence 태그. 숫자 점수로 환산하지 않는다. */
  tags: string[];
}

export interface ScenarioItem {
  id: string;
  kind: "scenario";
  subject: Subject;
  text: string;
  evidenceLabel: string;
  options: ScenarioOption[];
}

export interface ForcedChoiceOption {
  /** 1-based 선택지 번호. 두 개뿐이므로 1 또는 2. */
  index: 1 | 2;
  /** "A" | "B" */
  choice: string;
  text: string;
  /**
   * 이 선택지가 곧바로 뜻하는 construct 점수. 0 또는 100뿐이다.
   * 리커트처럼 1~5로 환산하지 않는다 — 중간값이 존재하지 않는 이분 응답이다.
   */
  score: 0 | 100;
}

/**
 * 강제선택 문항. "둘 중 실제로 더 자주 하는 쪽" 또는 "둘 중 더 잘 배울 쪽"을 고르게 한다.
 * 한 사람의 값은 0 또는 100 둘 중 하나뿐이라 평균·수치로 인용하지 않고 "고른 보기"로만 서술한다.
 */
export interface ForcedChoiceItem {
  id: string;
  kind: "forcedChoice";
  subject: Subject;
  construct: Construct;
  required: boolean;
  text: string;
  evidenceLabel: string;
  options: [ForcedChoiceOption, ForcedChoiceOption];
}

export type AssessmentItem = LikertItem | ScenarioItem | ForcedChoiceItem;

/** 선택지 index로 답하는 문항(상황문항·강제선택). 응답은 같은 버킷에 저장한다. */
export type ChoiceItem = ScenarioItem | ForcedChoiceItem;

/** Likert 응답값. 1~5 정수, 경험 없음, 또는 잘 모르겠음. */
export type LikertResponse = number | "not_applicable" | "unknown";
export type ResponseMap = Record<string, LikertResponse | null | undefined>;
/** 상황문항·강제선택 응답. 1-based 선택지 index. */
export type ScenarioResponseMap = Record<string, number | null | undefined>;

/** 점수값. 숫자 또는 유효응답 부족을 뜻하는 "insufficient". */
export type Score = number | "insufficient";

/** 등급 구간. high=잘 되고 있음(≥75) · mixed=지켜볼 것(62.5~75) · low=먼저 도울 것(<62.5). */
export type Band = "high" | "low" | "mixed";

export type MbtiConfidence = "high" | "medium" | "low" | "none";
export interface MbtiInput {
  type: string;
  confidence: MbtiConfidence;
}

/** 클리닉 참여 가능값. 서술을 숫자로 추측하지 않고 구조화된 값만 사용한다(사전정보 표시용). */
export type ClinicAvailability = 100 | 75 | 50 | 25 | null;

export type ResponseQualityCode =
  | "too_fast"
  | "straight_line"
  | "opposite_pair_review"
  | "insufficient";

export interface ResponseQualityReason {
  code: ResponseQualityCode;
  detail: string;
}

export interface ResponseQuality {
  status: "normal" | "review";
  reasons: ResponseQualityReason[];
}

export interface CommonScores {
  learningAttitude: Score;
  homeworkReliability: Score;
  goalClarity: Score;
  shortTermRecovery: Score;
  managementAcceptance: Score;
  coachingResponse: Score;
  questionInitiative: Score;
  phoneBoundary: Score;
  peerFocusBoundary: Score;
}

export interface MathScores {
  mathStrategy: Score;
  /** M6 원방향. 높을수록 낯선 유형 회피 신호가 큼(위험축). */
  mathNoveltyAvoidance: Score;
  /** M10 원방향. 높을수록 시험 긴장 방해 신호가 큼(위험축). */
  mathTestInterference: Score;
}

export interface EnglishScores {
  englishStrategy: Score;
  /** E7 원방향. 높을수록 긴 지문 회피 신호가 큼(위험축). */
  englishReadingAvoidance: Score;
  /** E10 원방향. 높을수록 시험 긴장 방해 신호가 큼(위험축). */
  englishTestInterference: Score;
}

/** 관리 수용 직접 질문(MA5)의 답. 문항 보기 순서와 같다. */
export type ManagementDirectAnswer =
  | "버틸 수 있다"
  | "힘들어도 해 보겠다"
  | "잘 모르겠다"
  | "힘들 것 같다";

export type ManagementVerdict =
  | "버틸 수 있음"
  | "도움이 있으면 버팀"
  | "지금은 어려움"
  | "판정 보류";

export type GuidanceVerdict =
  | "강하게 밀어도 됨"
  | "강하게 하되 다독임을 같이"
  | "차분히 다독이며"
  | "판정 보류";

/** ★ "철저한 관리를 버틸 수 있는가" 판정. */
export interface ManagementVerdictResult {
  verdict: ManagementVerdict;
  /** MA5에서 학생이 직접 고른 답. 미응답이면 null. */
  directAnswer: ManagementDirectAnswer | null;
  /** 관리 수용 점수가 몇 문항으로 나왔는지. 학원 경험이 없으면 2문항 기준이 된다. */
  basisItems: number;
  /** 결과지에 붙일 한 줄(예: 학원 경험이 없어 두 문항 기준입니다). 없으면 null. */
  basisNote: string | null;
}

/** ★ "강하게 밀어도 되는가, 차분히 다독여야 하는가" 판정. */
export interface GuidanceVerdictResult {
  verdict: GuidanceVerdict;
  /** CR5 강제선택. "A"=바로 세게 짚어 주는 선생님, "B"=잘한 점을 먼저 말하고 차분히 고쳐 주는 선생님. */
  choice: "A" | "B" | null;
  choiceText: string | null;
  /** 점수와 본인 선택이 어긋나 상담에서 실제 사례를 확인해야 하는지. */
  confirmInCounseling: boolean;
}

export interface Verdicts {
  management: ManagementVerdictResult;
  guidance: GuidanceVerdictResult;
}

export interface SituationEvidence {
  evidenceLabel: string;
  choice: string;
  tags: string[];
}

export interface ScoringMeta {
  /** 점수형 구간 활성 응답시간(초). */
  activeSeconds?: number;
  /** 점수형 문항별 노출→첫 선택 지연(ms). */
  firstSelectDelays?: number[];
}

export interface ScoringInput {
  subjectSelection: SubjectSelection;
  responses: ResponseMap;
  scenarioResponses?: ScenarioResponseMap;
  /** 학생이 적은 MBTI. 점수·판정에 쓰지 않고 결과지 종합 소견 문장에만 쓴다. */
  mbti?: MbtiInput | null;
  meta?: ScoringMeta;
}

export interface ScoreProfile {
  instrumentVersion: "v2";
  /** v2 안에서 문항 구성이 달라진 시점을 구분한다. 과거 응답과 새 응답의 혼합 집계 금지. */
  instrumentRevision?: string;
  subjectSelection: SubjectSelection;
  common: CommonScores;
  math: MathScores | null;
  english: EnglishScores | null;
  /** 핵심 판단 두 가지(v2.3). 과거 리비전 저장분에는 없다. */
  verdicts?: Verdicts;
  situations: Record<string, SituationEvidence>;
  responseQuality: ResponseQuality;
}

/**
 * surveys.intake_v2에 저장되는 실제 JSONB 구조.
 *
 * 학생 설문 입력 상태(IntakeData)는 필수 문자열을 사용하지만, DB의 과거·부분 저장
 * 데이터까지 안전하게 읽기 위해 표시 계층에서는 모든 필드를 optional/nullable로 본다.
 */
export interface StoredIntakeV2 {
  subject_selection?: SubjectSelection | null;
  profile_notice_acknowledged?: boolean | null;
  profile_notice_version?: string | null;
  profile_notice_acknowledged_at?: string | null;
  prev_academy?: string | null;
  prev_academy_duration?: string | null;
  prev_leave_reason?: string | null;
  prev_complaint?: string | null;
  prev_concerns?: string[] | null;
  referral?: string | null;
  referral_friend?: string | null;
  nk_knowledge?: string | null;
  nk_expectations?: string[] | null;
  preferred_days?: string | null;
  available_time?: string | null;
  weekday_selfstudy?: string | null;
  clinic_condition?: string | null;
  commute_method?: string | null;
  commute_time?: string | null;
  has_future_plan?: string | null;
  dream?: string | null;
  target_university?: string | null;
  study_core?: string | null;
  problem_self?: string | null;
  math_difficulty?: string | null;
  english_difficulty?: string | null;
  /** v2.3: 과목별 어려운 점 선택(최대 3). */
  math_difficulty_tags?: string[] | null;
  english_difficulty_tags?: string[] | null;
  health_note?: string | null;
  requests?: string | null;
  mbti?: string | null;
  mbti_confidence?: MbtiConfidence | null;
  /** 저장 키는 하위호환용. 뜻은 "입학 상담에서 가장 도움받고 싶은 점". */
  commitment14?: string | null;
}

/** surveys.responses_v2에 저장되는 raw 응답 JSONB 구조. */
export interface StoredResponsesV2 {
  instrument_revision?: string | null;
  responses?: Record<string, LikertResponse | null | undefined> | null;
  scenarios?: Record<string, number | null | undefined> | null;
  supplements?: Record<string, string | null | undefined> | null;
}

/** surveys.response_meta_v2에 저장되는 응답 메타데이터. */
export interface StoredResponseMetaV2 extends ScoringMeta {
  items?: Record<
    string,
    {
      exposedAt?: number;
      firstSelectAt?: number;
      lastEditAt?: number;
    }
  >;
}
