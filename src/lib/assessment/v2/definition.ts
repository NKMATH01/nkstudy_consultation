// 설문 V2 문항 정의 (typed definition).
// 문구는 docs/prototypes/2026-07-10-learning-profile-v2/survey.js 원문을 그대로 옮긴다.
// construct / direction / 위험축 분리는 구현 명세서 §5, §8.7 계약을 따른다.

import type {
  AssessmentItem,
  LikertItem,
  ScenarioItem,
  SubjectSelection,
} from "./types";

/** 8.7.1 고정 역채점 ID. definition.direction과 반드시 일치해야 한다. */
export const REVERSE_IDS: ReadonlySet<string> = new Set([
  "LT4",
  "P2",
  "P4",
  "G4",
  "B2",
  "F3",
]);

/** 8.1 유효응답 최소 비율. 미만이면 해당 composite는 insufficient. */
export const MIN_VALID_RATIO = 0.75;

// 내부 헬퍼: 문구를 간결하게 유지하기 위한 Likert 팩토리.
function likert(
  item: Pick<
    LikertItem,
    "id" | "subject" | "construct" | "scale" | "text" | "evidenceLabel"
  > &
    Partial<Pick<LikertItem, "weight" | "required" | "allowUnknown" | "supplement">>
): LikertItem {
  return {
    kind: "likert",
    weight: item.weight ?? 1,
    required: item.required ?? true,
    allowUnknown: item.allowUnknown ?? false,
    direction: REVERSE_IDS.has(item.id) ? "reverse" : "positive",
    ...item,
  };
}

// ── 공통 영역 (36문항) ────────────────────────────────────────────────

const LEARNING_ATTITUDE: LikertItem[] = [
  likert({ id: "LT1", subject: "common", construct: "learningAttitude", scale: "frequency", evidenceLabel: "수업 진입", text: "수업이 시작되면 필요한 교재를 준비하고 바로 집중한다." }),
  likert({ id: "LT2", subject: "common", construct: "learningAttitude", scale: "frequency", evidenceLabel: "핵심 포착", text: "설명을 들으며 핵심 내용이나 모르는 부분을 표시한다." }),
  likert({ id: "LT3", subject: "common", construct: "learningAttitude", scale: "frequency", evidenceLabel: "확인 행동", text: "이해되지 않은 부분은 수업 중이나 끝난 뒤 질문하거나 다시 확인한다." }),
  likert({ id: "LT4", subject: "common", construct: "learningAttitude", scale: "frequency", evidenceLabel: "주의 유지", text: "이미 아는 내용이 나오면 다른 생각을 하거나 대충 듣는 편이다." }),
];

const HOMEWORK: LikertItem[] = [
  likert({ id: "H1", subject: "common", construct: "homeworkReliability", scale: "frequency", evidenceLabel: "시작", text: "숙제가 나온 날 또는 미리 정한 시간에 첫 부분을 시작한다." }),
  likert({ id: "H2", subject: "common", construct: "homeworkReliability", scale: "frequency", evidenceLabel: "기한", text: "어려운 문항이 있어도 할 수 있는 부분까지 기한 안에 제출한다." }),
  likert({ id: "H3", subject: "common", construct: "homeworkReliability", scale: "frequency", evidenceLabel: "품질 확인", text: "제출 전에 빠진 문항과 풀이·근거를 확인한다." }),
  likert({ id: "H4", subject: "common", construct: "homeworkReliability", scale: "frequency", evidenceLabel: "오답 복구", text: "피드백 받은 오답은 틀린 이유를 확인하고 다시 풀어본다." }),
];

const PHONE: LikertItem[] = [
  likert({ id: "P1", subject: "common", construct: "phoneBoundary", scale: "frequency", evidenceLabel: "공부 시작", text: "공부 시작 전에 휴대폰을 손이 닿지 않는 곳에 두거나 집중 모드를 켠다." }),
  likert({ id: "P2", subject: "common", construct: "phoneBoundary", scale: "frequency", evidenceLabel: "자동 확인", text: "알림이 오지 않아도 공부 중 습관적으로 휴대폰을 열어본다." }),
  likert({ id: "P3", subject: "common", construct: "phoneBoundary", scale: "frequency", evidenceLabel: "통제 회복", text: "계획보다 오래 사용했다고 알아차리면 앱 제한·보관 장소·타이머를 스스로 조정한다." }),
  likert({
    id: "P4",
    subject: "common",
    construct: "phoneBoundary",
    scale: "frequency",
    evidenceLabel: "취침 경계",
    text: "잠들기로 정한 시간이 지나도 휴대폰을 계속 사용하는 날이 많다.",
    supplement: {
      title: "사용시간만으로 판단하지 않지만, 실제 생활 맥락을 함께 확인합니다.",
      fields: [
        { id: "phone_weekday", label: "평일 오락용 사용시간", options: ["1시간 미만", "1~2시간", "2~3시간", "3~5시간", "5시간 이상"] },
        { id: "phone_bedtime", label: "취침 후 사용 빈도", options: ["거의 없음", "주 1일", "주 2~3일", "주 4~5일", "거의 매일"] },
      ],
    },
  }),
];

const WILL: LikertItem[] = [
  likert({ id: "G1", subject: "common", construct: "longTermPersistence", scale: "frequency", evidenceLabel: "장기 목표", text: "3개월 뒤 목표와 이번 주에 해야 할 일을 연결해 말할 수 있다." }),
  likert({ id: "G2", subject: "common", construct: "longTermPersistence", scale: "frequency", evidenceLabel: "루틴 지속", text: "성과가 바로 보이지 않아도 정한 학습 루틴을 몇 주간 이어간다." }),
  likert({ id: "G3", subject: "common", construct: "longTermPersistence", scale: "frequency", evidenceLabel: "반복 인내", text: "지루한 반복 연습도 필요하다고 판단하면 계속한다." }),
  likert({ id: "G4", subject: "common", construct: "longTermPersistence", scale: "frequency", evidenceLabel: "목표 유지", text: "몇 주간 성과가 없으면 방법을 점검하기 전에 목표 자체를 포기한다." }),
  likert({ id: "B1", subject: "common", construct: "shortTermRecovery", scale: "frequency", evidenceLabel: "난관 체류", text: "어려운 과제는 해설을 보기 전에 약 10분간 스스로 시도한다." }),
  likert({ id: "B2", subject: "common", construct: "shortTermRecovery", scale: "frequency", evidenceLabel: "점수 회복", text: "예상보다 낮은 점수를 받으면 다음 수업 전까지 그 과목을 피하게 된다." }),
  likert({ id: "B3", subject: "common", construct: "shortTermRecovery", scale: "frequency", evidenceLabel: "재시작", text: "틀렸다는 피드백을 받은 뒤 같은 날이나 다음 예정 시간에 다시 시작한다." }),
  likert({ id: "B4", subject: "common", construct: "shortTermRecovery", scale: "frequency", evidenceLabel: "과부하 대처", text: "할 일이 갑자기 많아지면 가장 작은 단위로 나누어 하나부터 시작한다." }),
];

const RESPONSE: LikertItem[] = [
  likert({ id: "R1", subject: "common", construct: "structureNeed", scale: "agreement", evidenceLabel: "적응 방식", text: "낯선 반이나 선생님을 만날 때 진행 방식과 규칙을 미리 알면 적응이 빨라진다." }),
  likert({ id: "R2", subject: "common", construct: "reflectiveProcessingNeed", scale: "agreement", evidenceLabel: "생각 처리", text: "바로 말하기보다 혼자 생각할 시간을 가진 뒤 1:1로 질문할 때 더 잘 이해한다." }),
  likert({ id: "R3", subject: "common", construct: "directFeedbackAcceptance", scale: "agreement", evidenceLabel: "직접 피드백", text: "선생님이 부족한 점을 분명하고 직접적으로 말해주면 다음 행동이 선명해진다." }),
  likert({ id: "R4", subject: "common", construct: "relationshipSafetyNeed", scale: "agreement", evidenceLabel: "관계 안전", text: "여러 사람 앞에서 지적받으면 고칠 내용보다 감정이 오래 남는 편이다." }),
  likert({ id: "R5", subject: "common", construct: "autonomyNeed", scale: "agreement", evidenceLabel: "자율성", text: "해야 하는 이유를 듣고 순서·방법 중 하나를 선택하면 책임감이 커진다." }),
  likert({ id: "R6", subject: "common", construct: "structureNeed", scale: "agreement", evidenceLabel: "구조 필요", text: "마감·완료 기준·중간 확인 시간이 구체적일수록 시작하기 쉽다." }),
];

const FRIENDS: LikertItem[] = [
  likert({ id: "F1", subject: "common", construct: "peerLearningResource", scale: "agreement", evidenceLabel: "새 환경", text: "새 반에서도 필요한 순간에는 먼저 인사하거나 질문할 수 있다." }),
  likert({ id: "F2", subject: "common", construct: "peerLearningResource", scale: "agreement", evidenceLabel: "또래 자원", text: "혼자 경쟁하는 분위기보다 서로 질문하고 확인해주는 반에서 더 잘 배운다." }),
  likert({ id: "F3", subject: "common", construct: "peerFocusBoundary", scale: "agreement", evidenceLabel: "집중 경계", text: "친한 친구와 같은 반이면 대화 때문에 해야 할 일을 늦출 때가 있다." }),
  likert({ id: "F4", subject: "common", construct: "peerLearningResource", scale: "agreement", evidenceLabel: "갈등 회복", text: "친구와 불편한 일이 생기면 피하기만 하지 않고 말로 풀거나 선생님에게 도움을 요청한다." }),
];

const NK_FIT: LikertItem[] = [
  likert({ id: "N1", subject: "common", construct: "nkFit", scale: "fit", allowUnknown: true, evidenceLabel: "클리닉", text: "배정 반에 클리닉이나 보완학습이 있다면 일정에 맞춰 참여하는 운영이 나에게 도움이 될 것 같다." }),
  likert({ id: "N2", subject: "common", construct: "nkFit", scale: "fit", allowUnknown: true, evidenceLabel: "주간 테스트", text: "주간 테스트로 배운 내용을 자주 확인하고 부족한 부분을 다시 보완하는 방식이 나와 맞을 것 같다." }),
  likert({ id: "N3", subject: "common", construct: "nkFit", scale: "fit", allowUnknown: true, evidenceLabel: "숙제·보충", text: "숙제를 기한 안에 제출하고, 미제출이 누적되면 의무 보충학습을 하는 규칙을 받아들일 수 있다." }),
  likert({
    id: "N4",
    subject: "common",
    construct: "nkFit",
    scale: "fit",
    allowUnknown: true,
    evidenceLabel: "진행 점검",
    text: "선생님이 진도와 과제 상태를 구체적으로 확인하고 바로 피드백하는 관리가 나에게 도움이 될 것 같다.",
    supplement: {
      title: "NK 운영 중 기대되는 점과 걱정되는 점을 각각 골라주세요.",
      fields: [
        { id: "nk_expected", label: "가장 기대되는 운영", options: ["클리닉·보완학습", "주간 테스트", "숙제·의무 보충", "진도·과제 점검", "아직 모르겠음"] },
        { id: "nk_concern", label: "가장 걱정되는 운영", options: ["클리닉·보완학습", "주간 테스트", "숙제·의무 보충", "진도·과제 점검", "특별히 없음"] },
      ],
    },
  }),
];

const COMMON_SCENARIOS: ScenarioItem[] = [
  {
    id: "C1",
    kind: "scenario",
    subject: "common",
    evidenceLabel: "점수·핸드폰",
    text: "주간 테스트가 예상보다 낮고 보완 문제를 시작하려는데 휴대폰 알림이 계속 온다. 가장 가까운 반응은?",
    options: [
      { index: 1, choice: "A", text: "알림을 확인하고 기분이 나아지면 시작한다.", tags: ["phone_first", "delayed_restart", "mood_before_action"] },
      { index: 2, choice: "B", text: "휴대폰은 치우지만 쉬운 과제부터 하며 보완을 미룬다.", tags: ["phone_removed", "easy_task_substitution", "hard_task_delay"] },
      { index: 3, choice: "C", text: "휴대폰을 치우고 오답 1개의 원인부터 적는다.", tags: ["phone_removed", "error_cause_first", "independent_restart"] },
      { index: 4, choice: "D", text: "선생님에게 시작 순서와 확인 시간을 요청한다.", tags: ["support_seeking", "external_structure", "scheduled_check"] },
    ],
  },
  {
    id: "C2",
    kind: "scenario",
    subject: "common",
    evidenceLabel: "새 반·클리닉",
    text: "새 반 첫 주, 아는 친구가 없고 수업 후 클리닉까지 참여해야 한다. 가장 도움이 되는 방식은?",
    options: [
      { index: 1, choice: "A", text: "순서와 규칙을 미리 듣고 혼자 익힐 시간을 가진다.", tags: ["structure_preview", "solo_adaptation"] },
      { index: 2, choice: "B", text: "선생님이 1:1로 질문할 부분을 확인해준다.", tags: ["one_to_one_safety", "guided_question"] },
      { index: 3, choice: "C", text: "비슷한 수준의 학생 한 명과 짝으로 확인한다.", tags: ["peer_bridge", "collaborative_entry"] },
      { index: 4, choice: "D", text: "바로 흐름에 참여하고 필요할 때 직접 질문한다.", tags: ["rapid_participation", "direct_question"] },
    ],
  },
];

export const COMMON_ITEMS: AssessmentItem[] = [
  ...LEARNING_ATTITUDE,
  ...HOMEWORK,
  ...PHONE,
  ...WILL,
  ...RESPONSE,
  ...FRIENDS,
  ...NK_FIT,
  ...COMMON_SCENARIOS,
];

// ── 수학 전용 (12문항) ────────────────────────────────────────────────

const MATH_STRATEGY: LikertItem[] = [
  likert({ id: "M1", subject: "math", construct: "mathStrategy", scale: "frequency", evidenceLabel: "조건 정리", text: "해설을 보기 전에 주어진 조건과 구해야 할 것을 정리한다." }),
  likert({ id: "M2", subject: "math", construct: "mathStrategy", scale: "frequency", evidenceLabel: "대안 탐색", text: "한 풀이가 막히면 식, 그림, 표 등 다른 방법을 시도한다." }),
  likert({ id: "M3", subject: "math", construct: "mathStrategy", scale: "frequency", evidenceLabel: "풀이 기록", text: "나중에 다시 볼 수 있도록 풀이 이유와 단계를 적는다." }),
  likert({ id: "M4", subject: "math", construct: "mathStrategy", scale: "frequency", evidenceLabel: "오류 분류", text: "틀린 문제를 개념, 조건 해석, 풀이 과정, 계산 실수로 나눠 본다." }),
  likert({ id: "M5", subject: "math", construct: "mathStrategy", scale: "frequency", evidenceLabel: "지연 재풀이", text: "오답을 며칠 뒤 해설 없이 다시 푼다." }),
  likert({ id: "M6", subject: "math", construct: "mathNoveltyAvoidance", scale: "frequency", evidenceLabel: "낯선 유형", text: "처음 보는 유형이면 시도하기 전부터 못 풀 것 같아 넘긴다." }),
  likert({ id: "M7", subject: "math", construct: "mathStrategy", scale: "frequency", evidenceLabel: "검산", text: "답을 낸 뒤 조건 누락과 계산 과정을 확인한다." }),
  likert({ id: "M8", subject: "math", construct: "mathStrategy", scale: "frequency", evidenceLabel: "누적 복습", text: "현재 단원뿐 아니라 이전 단원도 누적해서 복습한다." }),
  likert({ id: "M9", subject: "math", construct: "mathSelfEfficacy", scale: "agreement", evidenceLabel: "자기효능감", text: "어려운 수학도 방법을 나눠 연습하면 향상될 수 있다고 느낀다." }),
  likert({ id: "M10", subject: "math", construct: "mathTestInterference", scale: "frequency", evidenceLabel: "시험 방해감", text: "수학 시험에서 긴장하면 평소 알던 풀이 순서가 잘 떠오르지 않는다." }),
];

const MATH_SCENARIOS: ScenarioItem[] = [
  {
    id: "MS1",
    kind: "scenario",
    subject: "math",
    evidenceLabel: "낯선 문제",
    text: "낯선 문제를 10분 동안 풀어도 막혀 있다. 그다음 행동과 가장 가까운 것은?",
    options: [
      { index: 1, choice: "A", text: "표시만 하고 바로 넘긴다.", tags: ["defer_without_recovery_plan"] },
      { index: 2, choice: "B", text: "해설을 보고 같은 풀이를 옮겨 적는다.", tags: ["solution_copy"] },
      { index: 3, choice: "C", text: "작은 힌트를 받은 뒤 처음부터 다시 시도한다.", tags: ["hint_then_retry"] },
      { index: 4, choice: "D", text: "조건을 그림이나 식으로 바꿔 적고 다른 접근을 시도한다.", tags: ["re_represent_and_try_alternative"] },
    ],
  },
  {
    id: "MS2",
    kind: "scenario",
    subject: "math",
    evidenceLabel: "반복 실수",
    text: "비슷한 계산 실수가 세 번 반복됐다. 가장 가까운 대응은?",
    options: [
      { index: 1, choice: "A", text: "다음에는 조심하겠다고 생각하고 넘어간다.", tags: ["intention_only"] },
      { index: 2, choice: "B", text: "같은 유형 문제 양을 더 늘린다.", tags: ["quantity_increase"] },
      { index: 3, choice: "C", text: "실수 지점을 분류하고 며칠 뒤 다시 푼다.", tags: ["error_classify_and_spaced_retry"] },
      { index: 4, choice: "D", text: "설명을 들은 뒤 실수 방지 규칙을 내 말로 정리한다.", tags: ["verbalize_prevention_rule"] },
    ],
  },
];

export const MATH_ITEMS: AssessmentItem[] = [...MATH_STRATEGY, ...MATH_SCENARIOS];

// ── 영어 전용 (12문항) ────────────────────────────────────────────────

const ENGLISH_STRATEGY: LikertItem[] = [
  likert({ id: "E1", subject: "english", construct: "englishStrategy", scale: "frequency", evidenceLabel: "간격 반복", text: "단어를 한 번에 몰아서 외우기보다 날짜를 나눠 반복한다." }),
  likert({ id: "E2", subject: "english", construct: "englishStrategy", scale: "frequency", evidenceLabel: "인출", text: "단어 뜻을 보기 전에 스스로 떠올리는 방식으로 확인한다." }),
  likert({ id: "E3", subject: "english", construct: "englishStrategy", scale: "frequency", evidenceLabel: "문맥 추론", text: "모르는 단어가 있어도 문장 구조와 문맥으로 뜻을 추론하며 읽는다." }),
  likert({ id: "E4", subject: "english", construct: "englishStrategy", scale: "frequency", evidenceLabel: "문법 설명", text: "문법 문제를 맞힌 뒤에도 왜 그 답인지 설명해 본다." }),
  likert({ id: "E5", subject: "english", construct: "englishStrategy", scale: "frequency", evidenceLabel: "독해 오답", text: "독해 오답은 지문 근거와 내가 잘못 판단한 이유를 찾는다." }),
  likert({ id: "E6", subject: "english", construct: "englishStrategy", scale: "frequency", evidenceLabel: "듣기 복구", text: "잘 안 들리는 부분은 먼저 반복해 듣고 이후 대본으로 확인한다." }),
  likert({ id: "E7", subject: "english", construct: "englishReadingAvoidance", scale: "frequency", evidenceLabel: "긴 지문", text: "긴 지문을 보면 끝까지 읽기 전에 포기하는 편이다." }),
  likert({ id: "E8", subject: "english", construct: "englishStrategy", scale: "frequency", evidenceLabel: "노출 빈도", text: "시험 직전만이 아니라 주 4일 이상 영어를 접한다." }),
  likert({ id: "E9", subject: "english", construct: "englishSelfEfficacy", scale: "agreement", evidenceLabel: "자기효능감", text: "영어도 맞는 방법으로 연습하면 향상될 수 있다고 느낀다." }),
  likert({ id: "E10", subject: "english", construct: "englishTestInterference", scale: "frequency", evidenceLabel: "시험 방해감", text: "영어 시험에서 긴장하면 알던 단어나 문장도 잘 읽히지 않는다." }),
];

const ENGLISH_SCENARIOS: ScenarioItem[] = [
  {
    id: "ES1",
    kind: "scenario",
    subject: "english",
    evidenceLabel: "긴 지문",
    text: "긴 지문에 모르는 단어가 여러 개 나왔다. 실제 행동과 가장 가까운 것은?",
    options: [
      { index: 1, choice: "A", text: "모든 단어를 하나씩 번역한 뒤 읽는다.", tags: ["full_translation"] },
      { index: 2, choice: "B", text: "아는 단어만 보고 답을 추측한다.", tags: ["guess_from_known_words"] },
      { index: 3, choice: "C", text: "문장 구조와 문맥을 이용해 끝까지 읽는다.", tags: ["syntax_context_persistence"] },
      { index: 4, choice: "D", text: "전체 흐름을 먼저 잡고 핵심 단어만 다시 확인한다.", tags: ["global_read_then_targeted_check"] },
    ],
  },
  {
    id: "ES2",
    kind: "scenario",
    subject: "english",
    evidenceLabel: "단어 기억",
    text: "외운 단어를 며칠 뒤 자꾸 잊는다. 다음 방법과 가장 가까운 것은?",
    options: [
      { index: 1, choice: "A", text: "시험 전날 한 번에 다시 외운다.", tags: ["massed_relearning"] },
      { index: 2, choice: "B", text: "같은 단어를 여러 번 베껴 쓴다.", tags: ["copy_repetition"] },
      { index: 3, choice: "C", text: "간격을 두고 뜻을 가린 채 스스로 떠올린다.", tags: ["spaced_retrieval"] },
      { index: 4, choice: "D", text: "예문이나 어구에 사용하며 스스로 시험한다.", tags: ["contextual_use_and_self_test"] },
    ],
  },
];

export const ENGLISH_ITEMS: AssessmentItem[] = [...ENGLISH_STRATEGY, ...ENGLISH_SCENARIOS];

// ── 조회 헬퍼 ────────────────────────────────────────────────────────

export const ALL_ITEMS: AssessmentItem[] = [
  ...COMMON_ITEMS,
  ...MATH_ITEMS,
  ...ENGLISH_ITEMS,
];

export function getItemsForSubject(selection: SubjectSelection): AssessmentItem[] {
  const subject =
    selection === "math"
      ? MATH_ITEMS
      : selection === "english"
        ? ENGLISH_ITEMS
        : [...MATH_ITEMS, ...ENGLISH_ITEMS];
  return [...COMMON_ITEMS, ...subject];
}

export function isLikert(item: AssessmentItem): item is LikertItem {
  return item.kind === "likert";
}

export function isScenario(item: AssessmentItem): item is ScenarioItem {
  return item.kind === "scenario";
}
