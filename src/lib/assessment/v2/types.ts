// 설문 V2 학습 프로필 타입 정의.
// 이 모듈은 순수 타입만 포함하며 런타임 로직을 두지 않는다.

export type Scale = "frequency" | "agreement" | "fit";
export type Direction = "positive" | "reverse";
export type Subject = "common" | "math" | "english";
export type SubjectSelection = "math" | "english" | "both";

/** Likert 문항이 기여하는 점수 축(composite). 상황문항은 여기에 포함되지 않는다. */
export type Construct =
  | "learningAttitude"
  | "homeworkReliability"
  | "phoneBoundary"
  | "longTermPersistence"
  | "shortTermRecovery"
  | "peerLearningResource"
  | "peerFocusBoundary"
  | "reflectiveProcessingNeed"
  | "directFeedbackAcceptance"
  | "relationshipSafetyNeed"
  | "autonomyNeed"
  | "structureNeed"
  | "nkFit"
  | "mathStrategy"
  | "mathSelfEfficacy"
  | "mathNoveltyAvoidance"
  | "mathTestInterference"
  | "englishStrategy"
  | "englishSelfEfficacy"
  | "englishReadingAvoidance"
  | "englishTestInterference";

export interface SupplementField {
  id: string;
  label: string;
  options: string[];
}

export interface Supplement {
  title: string;
  fields: SupplementField[];
}

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
  /** "아직 잘 모르겠다"(unknown) 선택을 허용하는지 (N1~N4). */
  allowUnknown: boolean;
  text: string;
  /** 보고서 근거 라벨 (프로토타입 tag). */
  evidenceLabel: string;
  /** 생활 맥락 보조 입력. 점수에 반영하지 않는다. */
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
 * 강제선택 문항. "둘 중 실제로 더 자주 하는 쪽"을 고르게 한다.
 *
 * 리커트와 달리 중간(3점)으로 물러설 자리가 없어 선호가 선명하게 갈린다.
 * 대신 한 사람의 값은 0 또는 100 둘 중 하나뿐이라, 이 문항으로 만든 점수는
 * 평균·수치로 인용하지 않고 "고른 보기"로만 서술한다(construct-guide 단일문항 규칙).
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

/** Likert 응답값. 1~5 정수 또는 "unknown"(잘 모르겠음). */
export type LikertResponse = number | "unknown";
export type ResponseMap = Record<string, LikertResponse | null | undefined>;
/** 상황문항·강제선택 응답. 1-based 선택지 index. */
export type ScenarioResponseMap = Record<string, number | null | undefined>;

/** 점수값. 숫자 또는 유효응답 부족을 뜻하는 "insufficient". */
export type Score = number | "insufficient";

export type Band = "high" | "low" | "mixed";

export type MbtiConfidence = "high" | "medium" | "low" | "none";
export interface MbtiInput {
  type: string;
  confidence: MbtiConfidence;
}

/** 클리닉 참여 가능값. 서술을 숫자로 추측하지 않고 구조화된 값만 사용한다. */
export type ClinicAvailability = 100 | 75 | 50 | 25 | null;

export interface AxisScore {
  raw: Score;
  /** MBTI 보조 조정값(final - raw). insufficient면 null. */
  delta: number | null;
  final: Score;
  /** 직접 행동 관찰 문항이 없는 축(conceptAxis)에 표시. */
  lowEvidence?: boolean;
}

export interface MbtiAxes {
  interactionAxis: AxisScore;
  conceptAxis: AxisScore;
  relationalFeedbackAxis: AxisScore;
  flexibilityAxis: AxisScore;
  /** 유효 MBTI + 확신도로 실제 보조 반영이 적용됐는지. */
  applied: boolean;
  confidenceWeight: number;
}

export type NkFeature = "clinic" | "weeklyTest" | "homework" | "immediateFeedback";

export interface NkFitArea {
  preference: number | null;
  readiness: number | null;
  featureFit: number | null;
  /** |preference - readiness|. 둘 다 유효할 때만. */
  gap: number | null;
}

export type NkFitStage =
  | "자연스러운 일치"
  | "지원 전제 일치"
  | "조건 조율 필요"
  | "상담 확인 필요";

export interface NkFit {
  areas: Record<NkFeature, NkFitArea>;
  overall: number | null;
  stage: NkFitStage;
  /** 학생이 우선 선택한 기대 중 featureFit 60 미만이라 상담 질문에 올릴 기능. */
  priorityConcerns: NkFeature[];
}

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
  phoneBoundary: Score;
  longTermPersistence: Score;
  shortTermRecovery: Score;
  peerLearningResource: Score;
  peerFocusBoundary: Score;
  reflectiveProcessingNeed: Score;
  directFeedbackAcceptance: Score;
  relationshipSafetyNeed: Score;
  autonomyNeed: Score;
  structureNeed: Score;
  conscientiousness: Score;
}

export interface CoachingProfile {
  /** directFeedbackAcceptance(R3). */
  challenge: Score;
  /** relationshipSafetyNeed(R4). */
  safety: Score;
  challengeBand: Band | null;
  safetyBand: Band | null;
  coachingType: string;
  autonomy: Score;
  structure: Score;
  autonomyBand: Band | null;
  structureBand: Band | null;
  autonomyStructureType: string;
}

export interface MathScores {
  mathStrategy: Score;
  mathSelfEfficacy: Score;
  /** M6 원방향. 높을수록 낯선 유형 회피 신호가 큼(위험축). */
  mathNoveltyAvoidance: Score;
  /** M10 원방향. 높을수록 시험 긴장 방해 신호가 큼(위험축). */
  mathTestInterference: Score;
}

export interface EnglishScores {
  englishStrategy: Score;
  englishSelfEfficacy: Score;
  /** E7 원방향. 높을수록 긴 지문 회피 신호가 큼(위험축). */
  englishReadingAvoidance: Score;
  /** E10 원방향. 높을수록 시험 긴장 방해 신호가 큼(위험축). */
  englishTestInterference: Score;
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
  mbti?: MbtiInput | null;
  clinicAvailability?: ClinicAvailability;
  priorityFeatures?: NkFeature[];
  meta?: ScoringMeta;
}

export interface ScoreProfile {
  instrumentVersion: "v2";
  subjectSelection: SubjectSelection;
  common: CommonScores;
  coaching: CoachingProfile;
  math: MathScores | null;
  english: EnglishScores | null;
  mbtiAxes: MbtiAxes;
  nkFit: NkFit;
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
  prev_academy?: string | null;
  prev_academy_duration?: string | null;
  prev_leave_reason?: string | null;
  prev_complaint?: string | null;
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
  health_note?: string | null;
  requests?: string | null;
  mbti?: string | null;
  mbti_confidence?: MbtiConfidence | null;
  commitment14?: string | null;
}

/** surveys.responses_v2에 저장되는 raw 응답 JSONB 구조. */
export interface StoredResponsesV2 {
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
