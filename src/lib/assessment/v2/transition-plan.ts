/**
 * 이전 학원 경험을 학생의 결함이 아닌 "새 환경에서 반복하지 않을 운영 조건"으로 바꾼다.
 *
 * 공개 보고서와 외부 AI에는 학원명·자유서술 원문을 싣지 않는다. 새 설문은 구조화 선택지를,
 * 과거 설문은 이 파일의 보수적인 키워드 분류만 사용해 고정 문구로 변환한다.
 */

export const PREVIOUS_ACADEMY_CONCERN_OPTIONS = [
  "수준·진도 불일치",
  "설명 방식이 맞지 않음",
  "질문·오답 피드백 부족",
  "숙제·복습 관리 부족",
  "과도한 숙제·압박",
  "교사·상담 소통 부족",
  "친구·수업 분위기 불편",
  "일정·통학 부담",
  "성적 변화 체감 부족",
  "특별한 불만 없음",
] as const;

export const PREVIOUS_ACADEMY_CONCERN_MAX = 3;

export type PreviousAcademyConcern =
  (typeof PREVIOUS_ACADEMY_CONCERN_OPTIONS)[number];

export interface TransitionPlanInput {
  prevConcerns?: string[] | null;
  prevLeaveReason?: string | null;
  prevComplaint?: string | null;
  requests?: string | null;
}

export interface TransitionPlanItem {
  concern: Exclude<PreviousAcademyConcern, "특별한 불만 없음"> | "추가 확인 필요";
  title: string;
  commitment: string;
  check: string;
}

const NONE = "특별한 불만 없음" as const;

const KEYWORDS: Array<{
  concern: Exclude<PreviousAcademyConcern, typeof NONE>;
  words: string[];
}> = [
  { concern: "수준·진도 불일치", words: ["진도", "수준", "선행", "너무 빠", "너무 느", "난이도"] },
  { concern: "설명 방식이 맞지 않음", words: ["설명", "이해가 안", "이해 안", "수업 방식", "강의 방식"] },
  { concern: "질문·오답 피드백 부족", words: ["질문", "오답", "피드백", "첨삭", "풀이 확인"] },
  { concern: "숙제·복습 관리 부족", words: ["숙제 관리", "과제 관리", "복습 관리", "관리 부족", "관리가 부족", "관리가 약", "체크 부족"] },
  { concern: "과도한 숙제·압박", words: ["숙제가 많", "과제가 많", "과도", "압박", "부담", "스트레스"] },
  { concern: "교사·상담 소통 부족", words: ["소통", "상담", "연락", "공지", "학부모"] },
  { concern: "친구·수업 분위기 불편", words: ["분위기", "친구", "소란", "집중 안", "눈치", "불편"] },
  { concern: "일정·통학 부담", words: ["시간표", "시간대", "요일", "통학", "거리", "차량", "일정"] },
  { concern: "성적 변화 체감 부족", words: ["성적", "점수", "향상", "정체", "효과", "변화가 없"] },
];

const PLAN_BY_CONCERN: Record<
  Exclude<PreviousAcademyConcern, typeof NONE>,
  Omit<TransitionPlanItem, "concern">
> = {
  "수준·진도 불일치": {
    title: "수준과 진도부터 합의",
    commitment: "등록한다면 입학테스트 풀이와 학교 진도를 함께 보고 시작 단원과 수업 난이도를 제안합니다.",
    check: "입학 상담에서 학생·보호자와 시작점, 진도 속도, 보완 범위를 확인합니다.",
  },
  "설명 방식이 맞지 않음": {
    title: "설명 뒤 이해를 바로 확인",
    commitment: "등록한다면 설명 뒤 자기 말이나 한 문제 풀이로 이해를 확인하는 방식을 제안합니다.",
    check: "입학테스트 해설에서 학생이 이해하기 쉬웠던 설명 방식과 막힌 지점을 확인합니다.",
  },
  "질문·오답 피드백 부족": {
    title: "질문과 오답을 남기지 않기",
    commitment: "등록 시 사용할 질문 방법과 오답 처리 순서를 입학 상담에서 설명하고 편한 방식을 고릅니다.",
    check: "상담 기록에 질문 통로, 피드백 방식, 오답 확인 방법을 분명히 남깁니다.",
  },
  "숙제·복습 관리 부족": {
    title: "숙제보다 완료 과정 관리",
    commitment: "등록한다면 예상 과제량과 확인 방식을 설명하고, 학교 일정에 맞는 관리 강도를 함께 정합니다.",
    check: "입학 상담에서 숙제 시작, 제출, 오답 확인 중 어떤 도움이 가장 필요한지 고릅니다.",
  },
  "과도한 숙제·압박": {
    title: "지속 가능한 과제량 합의",
    commitment: "등록한다면 필수 과제와 선택 과제를 나누고 예상 소요 시간을 미리 안내합니다.",
    check: "학생의 학교 일정과 현재 자습 시간을 기준으로 감당 가능한 과제량을 합의합니다.",
  },
  "교사·상담 소통 부족": {
    title: "짧고 규칙적인 소통",
    commitment: "등록한다면 담당자, 질문 경로, 학습 상황을 공유하는 방법과 시점을 미리 안내합니다.",
    check: "학생·보호자가 어떤 정보를 얼마나 자주 받고 싶은지 입학 상담에서 확인합니다.",
  },
  "친구·수업 분위기 불편": {
    title: "집중하고 질문할 수 있는 환경",
    commitment: "좌석·또래 활동·질문 방식 중 불편한 조건을 입학 상담에서 확인하고 등록 시 조정 후보로 남깁니다.",
    check: "수업 뒤 집중과 질문 편안함을 짧게 확인하되 학생에게 적응 책임을 돌리지 않습니다.",
  },
  "일정·통학 부담": {
    title: "실행 가능한 시간표 점검",
    commitment: "등록한다면 등하원과 학교 일정을 함께 보고 지킬 수 있는 수업·보완 시간표를 제안합니다.",
    check: "통학 시간, 귀가 시각, 학교 일정을 반영해 무리 없는 선택인지 상담에서 확인합니다.",
  },
  "성적 변화 체감 부족": {
    title: "작은 변화의 근거를 공유",
    commitment: "등록한다면 입학테스트의 오답 유형을 출발점으로 가장 먼저 바꿀 학습 행동을 제안합니다.",
    check: "상담에서 시작 기준, 첫 목표, 학부모에게 공유할 변화 지표를 미리 합의합니다.",
  },
};

function isKnownConcern(value: string): value is PreviousAcademyConcern {
  return (PREVIOUS_ACADEMY_CONCERN_OPTIONS as readonly string[]).includes(value);
}

/** 자유서술 원문을 반환하지 않고, 고정된 서비스 경험 범주만 반환한다. */
export function normalizePreviousAcademyConcerns(
  input?: TransitionPlanInput | null,
): PreviousAcademyConcern[] {
  const selected = (input?.prevConcerns ?? [])
    .filter((value): value is PreviousAcademyConcern =>
      typeof value === "string" && isKnownConcern(value),
    )
    .slice(0, PREVIOUS_ACADEMY_CONCERN_MAX);

  if (selected.includes(NONE)) return [NONE];
  if (selected.length > 0) return [...new Set(selected)];

  const legacyText = [
    input?.prevLeaveReason,
    input?.prevComplaint,
    input?.requests,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (!legacyText.trim()) return [];
  if (/불만\s*없|아쉬운\s*점\s*없|만족/.test(legacyText)) return [NONE];

  return KEYWORDS
    .filter(({ words }) => words.some((word) => legacyText.includes(word)))
    .map(({ concern }) => concern)
    .slice(0, PREVIOUS_ACADEMY_CONCERN_MAX);
}

/** 공개 가능한 고정 문구만으로 입학 상담용 운영 원칙을 만든다. */
export function buildTransitionPlan(
  input?: TransitionPlanInput | null,
): TransitionPlanItem[] {
  const concerns = normalizePreviousAcademyConcerns(input);
  if (concerns.includes(NONE)) return [];

  const mapped = concerns
    .filter((concern): concern is Exclude<PreviousAcademyConcern, typeof NONE> => concern !== NONE)
    .map((concern) => ({ concern, ...PLAN_BY_CONCERN[concern] }));
  if (mapped.length > 0) return mapped;

  const hasLegacyText = [input?.prevLeaveReason, input?.prevComplaint, input?.requests]
    .some((value) => typeof value === "string" && value.trim().length > 0);
  return hasLegacyText
    ? [{
        concern: "추가 확인 필요",
        title: "이전 경험을 먼저 확인",
        commitment: "첫 상담에서 이전 환경의 아쉬움과 새 학원에 바라는 점을 학생의 말로 다시 확인합니다.",
        check: "입학 상담 기록에 반복하지 않아야 할 조건과 원하는 지원 방식을 남깁니다.",
      }]
    : [];
}
