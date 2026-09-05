// 설문 V2 문항 정의 (typed definition).
// 문구는 docs/prototypes/2026-07-10-learning-profile-v2/survey.js 원문을 그대로 옮긴다.
// construct / direction / 위험축 분리는 구현 명세서 §5, §8.7 계약을 따른다.

import type {
  AssessmentItem,
  ChoiceItem,
  ForcedChoiceItem,
  LikertItem,
  ScenarioItem,
  SubjectSelection,
} from "./types";

/**
 * 같은 v2 라우팅 안에서도 문항 구성이 달라졌음을 구분하는 운영 리비전.
 * 과거 38+11+12 응답과 새 40+10+10 응답을 통계에서 섞지 않는다.
 */
export const INSTRUMENT_REVISION = "v2.2-learning-disposition-60" as const;

/** 8.7.1 고정 역채점 ID. definition.direction과 반드시 일치해야 한다. */
export const REVERSE_IDS: ReadonlySet<string> = new Set([
  "LT4",
  "P2",
  "G4",
  "B2",
]);

/** 8.1 유효응답 최소 비율. 미만이면 해당 composite는 insufficient. */
export const MIN_VALID_RATIO = 0.75;

/**
 * 폐기된 문항 ID. 정의에서는 지웠지만 이미 학생 브라우저에 저장돼 있을 수 있어
 * 제출 검증이 "허용되지 않은 문항"으로 막지 않고 조용히 버린다.
 * (설문 도중 배포되면 저장된 응답에 남아 있다.)
 */
export const RETIRED_ITEM_IDS: ReadonlySet<string> = new Set([
  "M5",
  "M9",
  "E8",
  "E9",
  "R3-1",
  "R3-2",
  "N1",
  "N2",
  "N3",
  "N4",
]);

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

// ── 공통 학습성향 영역 (40문항) ──────────────────────────────────────

const LEARNING_ATTITUDE: LikertItem[] = [
  likert({ id: "LT1", subject: "common", construct: "learningAttitude", scale: "frequency", evidenceLabel: "수업 진입", text: "수업이 시작되면 필요한 교재를 준비하고 바로 집중한다." }),
  likert({ id: "LT2", subject: "common", construct: "learningAttitude", scale: "frequency", evidenceLabel: "핵심 포착", text: "설명을 들으며 핵심 내용이나 모르는 부분을 표시한다." }),
  likert({ id: "LT3", subject: "common", construct: "learningAttitude", scale: "frequency", evidenceLabel: "능동 참여", text: "수업 중 예제나 문제를 직접 풀면서 설명을 따라간다." }),
  likert({ id: "LT4", subject: "common", construct: "learningAttitude", scale: "frequency", evidenceLabel: "주의 유지", text: "이미 아는 내용이 나오면 다른 생각을 하거나 대충 듣는 편이다." }),
];

const HOMEWORK: LikertItem[] = [
  likert({ id: "H1", subject: "common", construct: "homeworkReliability", scale: "frequency", evidenceLabel: "시작", text: "숙제할 시간을 정하고, 그 시간에 첫 문제를 시작한다." }),
  likert({ id: "H2", subject: "common", construct: "homeworkReliability", scale: "frequency", evidenceLabel: "기한", text: "숙제를 기한 안에 낸다." }),
  likert({ id: "H3", subject: "common", construct: "homeworkReliability", scale: "frequency", evidenceLabel: "품질 확인", text: "숙제를 내기 전에 빠진 문제나 쓰지 않은 풀이가 없는지 확인한다." }),
  likert({ id: "H4", subject: "common", construct: "homeworkReliability", scale: "frequency", evidenceLabel: "마무리", text: "숙제를 다 못 한 날에는 다시 할 시간을 정해 마무리한다." }),
];

// 질문을 잘하는 '성격'이 아니라, 막힌 지점을 정리하고 실제로 도움을 쓰는 행동을 묻는다.
// 모든 frequency 문항의 회상 기간은 화면 안내에서 최근 2주로 통일한다.
const HELP_SEEKING: LikertItem[] = [
  likert({ id: "Q1", subject: "common", construct: "helpSeeking", scale: "frequency", allowUnknown: true, evidenceLabel: "도움 요청", text: "혼자 해결하기 어렵다면 선생님이나 친구에게 도움을 요청한다." }),
  likert({ id: "Q2", subject: "common", construct: "helpSeeking", scale: "frequency", allowUnknown: true, evidenceLabel: "질문 정리", text: "질문하기 전에 무엇을 알고 무엇을 모르는지 한 문장으로 정리한다." }),
  likert({ id: "Q3", subject: "common", construct: "helpSeeking", scale: "frequency", allowUnknown: true, evidenceLabel: "이해 확인", text: "설명을 들은 뒤, 이해한 내용을 내 말로 다시 설명해 본다." }),
  likert({ id: "Q4", subject: "common", construct: "helpSeeking", scale: "frequency", allowUnknown: true, evidenceLabel: "질문 확인", text: "질문할 것이 있으면 수업 중이나 끝난 뒤 확인한다." }),
];

// R3은 '직접 말해 주는 방식의 선호'로만 남기고, 피드백 뒤 실제 실행은 별도 4문항으로 잰다.
const FEEDBACK_EXECUTION: LikertItem[] = [
  likert({ id: "FB1", subject: "common", construct: "feedbackExecution", scale: "frequency", allowUnknown: true, evidenceLabel: "고칠 점 기록", text: "선생님에게 고칠 점을 들으면 그 부분을 표시하거나 적어 둔다." }),
  likert({ id: "FB2", subject: "common", construct: "feedbackExecution", scale: "frequency", allowUnknown: true, evidenceLabel: "직접 수정", text: "고칠 점을 들은 문제는 풀이와 답을 직접 고쳐 다시 완성한다." }),
  likert({ id: "FB3", subject: "common", construct: "feedbackExecution", scale: "frequency", allowUnknown: true, evidenceLabel: "수정 확인", text: "문제를 고친 뒤, 답이나 풀이가 맞는지 다시 확인한다." }),
  likert({ id: "FB4", subject: "common", construct: "feedbackExecution", scale: "frequency", allowUnknown: true, evidenceLabel: "다음 문제 적용", text: "비슷한 문제를 풀 때 전에 들은 고칠 점을 적용한다." }),
];

const PHONE: LikertItem[] = [
  likert({ id: "P1", subject: "common", construct: "phoneBoundary", scale: "frequency", allowUnknown: true, evidenceLabel: "공부 시작", text: "공부를 시작하기 전에 휴대폰을 눈에 보이지 않는 곳에 두거나 집중 모드를 켠다." }),
  likert({ id: "P2", subject: "common", construct: "phoneBoundary", scale: "frequency", allowUnknown: true, evidenceLabel: "자동 확인", text: "알림이 오지 않아도 공부 중 습관적으로 휴대폰을 열어본다." }),
  likert({ id: "P3", subject: "common", construct: "phoneBoundary", scale: "frequency", allowUnknown: true, evidenceLabel: "통제 회복", text: "휴대폰을 계획보다 오래 썼다면, 다음 공부 때 사용 방법을 스스로 바꾼다." }),
  likert({
    id: "P4",
    subject: "common",
    construct: "phoneBoundary",
    scale: "frequency",
    allowUnknown: true,
    evidenceLabel: "집중 복귀",
    text: "공부하다 휴대폰을 보게 되어도 5분 안에 하던 공부로 돌아온다.",
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
  likert({ id: "G1", subject: "common", construct: "longTermPersistence", scale: "frequency", evidenceLabel: "장기 목표", text: "이번 주 공부를 정할 때 더 큰 목표와 연결해 생각한다." }),
  likert({ id: "G2", subject: "common", construct: "longTermPersistence", scale: "frequency", evidenceLabel: "계획 지속", text: "결과가 바로 좋아지지 않아도 정한 공부 순서를 계속 지킨다." }),
  likert({ id: "G3", subject: "common", construct: "longTermPersistence", scale: "frequency", evidenceLabel: "반복 인내", text: "지루한 반복 연습도 필요하다고 판단하면 계속한다." }),
  likert({ id: "G4", subject: "common", construct: "longTermPersistence", scale: "frequency", evidenceLabel: "목표 유지", text: "결과가 빨리 좋아지지 않으면 하던 공부를 그만두는 편이다." }),
  likert({ id: "B1", subject: "common", construct: "shortTermRecovery", scale: "frequency", evidenceLabel: "난관 체류", text: "어려운 과제도 바로 해설을 보지 않고 먼저 스스로 시도한다." }),
  likert({ id: "B2", subject: "common", construct: "shortTermRecovery", scale: "frequency", allowUnknown: true, evidenceLabel: "점수 회복", text: "예상보다 낮은 점수를 받은 뒤 다음 공부를 미루거나 피한다." }),
  likert({ id: "B3", subject: "common", construct: "shortTermRecovery", scale: "frequency", allowUnknown: true, evidenceLabel: "재시작", text: "틀렸다는 설명을 들은 뒤 같은 날이나 다음 공부 시간에 다시 시작한다." }),
  likert({ id: "B4", subject: "common", construct: "shortTermRecovery", scale: "frequency", evidenceLabel: "과부하 대처", text: "할 일이 갑자기 많아지면 가장 작은 단위로 나누어 하나부터 시작한다." }),
];

const RESPONSE: LikertItem[] = [
  likert({ id: "R1", subject: "common", construct: "structureNeed", scale: "agreement", evidenceLabel: "적응 방식", text: "낯선 반이나 선생님을 만날 때 진행 방식과 규칙을 미리 알면 적응이 빨라진다." }),
  likert({ id: "R3", subject: "common", construct: "directFeedbackAcceptance", scale: "agreement", evidenceLabel: "직접 피드백", text: "고칠 점을 바로 말해 주면 무엇을 고쳐야 하는지 알기 쉽다." }),
  likert({ id: "R4", subject: "common", construct: "relationshipSafetyNeed", scale: "agreement", evidenceLabel: "관계 안전", text: "여러 사람 앞에서 지적받으면 고칠 내용보다 감정이 오래 남는 편이다." }),
  likert({ id: "R5", subject: "common", construct: "autonomyNeed", scale: "agreement", evidenceLabel: "자율성", text: "공부 순서나 방법을 직접 고를 수 있을 때 더 책임감 있게 한다." }),
  likert({ id: "R6", subject: "common", construct: "structureNeed", scale: "agreement", evidenceLabel: "구조 필요", text: "언제까지 무엇을 끝내야 하는지 분명하면 시작하기 쉽다." }),
];

/**
 * R2 강제선택. 예전에는 "혼자 생각할 시간을 가진 뒤 질문할 때 더 잘 이해한다"는 동의형이었는데
 * 대부분의 학생이 상위 2점을 골라 변별이 되지 않았다(천장 문항). 동의 여부가 아니라
 * 실제로 더 자주 하는 행동을 둘 중 하나로 고르게 바꾼다.
 */
const REFLECTIVE_FORCED: ForcedChoiceItem[] = [
  {
    id: "R2",
    kind: "forcedChoice",
    subject: "common",
    construct: "reflectiveProcessingNeed",
    required: true,
    evidenceLabel: "생각 처리",
    text: "수업 중 모르는 게 생겼을 때, 실제로 더 자주 하는 쪽은?",
    options: [
      { index: 1, choice: "A", text: "그 자리에서 바로 손을 들어 질문한다.", score: 0 },
      { index: 2, choice: "B", text: "일단 표시해 두고 수업이 끝난 뒤 따로 물어본다.", score: 100 },
    ],
  },
];

const FRIENDS: LikertItem[] = [
  likert({ id: "F1", subject: "common", construct: "peerLearningResource", scale: "agreement", evidenceLabel: "새 환경", text: "새 반에서도 필요한 때 먼저 질문할 수 있다." }),
  likert({ id: "F2", subject: "common", construct: "peerLearningResource", scale: "agreement", evidenceLabel: "또래 자원", text: "혼자 경쟁하는 분위기보다 서로 질문하고 확인해주는 반에서 더 잘 배운다." }),
  likert({ id: "F3", subject: "common", construct: "peerFocusBoundary", scale: "agreement", evidenceLabel: "집중 경계", text: "친한 친구와 같은 반이면 대화 때문에 해야 할 일을 늦출 때가 있다." }),
  likert({ id: "F4", subject: "common", construct: "peerLearningResource", scale: "agreement", allowUnknown: true, evidenceLabel: "갈등 회복", text: "친구와 불편한 일이 생기면 혼자 피하기보다 도움을 요청한다." }),
];

const COMMON_SCENARIOS: ScenarioItem[] = [
  {
    id: "C1",
    kind: "scenario",
    subject: "common",
    evidenceLabel: "점수·핸드폰",
    text: "연습시험 점수가 예상보다 낮고 틀린 문제를 다시 보려는데 휴대폰 알림이 계속 온다. 가장 가까운 반응은?",
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
    evidenceLabel: "새 반 적응",
    text: "새 반 첫날, 아는 친구가 없고 수업 순서를 모른다. 실제 행동과 가장 가까운 것은?",
    options: [
      { index: 1, choice: "A", text: "선생님에게 순서와 규칙을 먼저 물어보고 혼자 익힌다.", tags: ["structure_preview", "solo_adaptation"] },
      { index: 2, choice: "B", text: "선생님에게 내가 무엇부터 하면 되는지 따로 묻는다.", tags: ["one_to_one_safety", "guided_question"] },
      { index: 3, choice: "C", text: "옆 학생에게 지금 하는 순서를 물어본다.", tags: ["peer_bridge", "collaborative_entry"] },
      { index: 4, choice: "D", text: "먼저 수업을 따라가 보고, 막히면 그때 질문한다.", tags: ["rapid_participation", "direct_question"] },
    ],
  },
];

export const COMMON_ITEMS: AssessmentItem[] = [
  ...LEARNING_ATTITUDE,
  ...HOMEWORK,
  ...HELP_SEEKING,
  ...PHONE,
  ...WILL,
  ...FEEDBACK_EXECUTION,
  ...RESPONSE,
  ...REFLECTIVE_FORCED,
  ...FRIENDS,
  ...COMMON_SCENARIOS,
];

// ── 수학 공부 방식 보조 모듈 (10문항) ────────────────────────────────

const MATH_STRATEGY: LikertItem[] = [
  likert({ id: "M1", subject: "math", construct: "mathStrategy", scale: "frequency", evidenceLabel: "조건 정리", text: "해설을 보기 전에 주어진 조건과 구해야 할 것을 정리한다." }),
  likert({ id: "M2", subject: "math", construct: "mathStrategy", scale: "frequency", evidenceLabel: "대안 탐색", text: "한 풀이가 막히면 식, 그림, 표 등 다른 방법을 시도한다." }),
  likert({ id: "M3", subject: "math", construct: "mathStrategy", scale: "frequency", evidenceLabel: "풀이 기록", text: "나중에 다시 볼 수 있도록 풀이 이유와 단계를 적는다." }),
  likert({ id: "M4", subject: "math", construct: "mathStrategy", scale: "frequency", evidenceLabel: "오류 분류", text: "틀린 이유를 개념을 몰랐음, 문제를 잘못 읽음, 계산 실수처럼 나눠 본다." }),
  // M5(지연 재풀이)는 폐기. 같은 행동을 MS2 상황문항 C 선택지가 이미 묻는다. RETIRED_ITEM_IDS 참조.
  likert({ id: "M6", subject: "math", construct: "mathNoveltyAvoidance", scale: "frequency", evidenceLabel: "낯선 유형", text: "처음 보는 유형이면 시도하기 전부터 못 풀 것 같아 넘긴다." }),
  likert({ id: "M7", subject: "math", construct: "mathStrategy", scale: "frequency", evidenceLabel: "검산", text: "답을 낸 뒤 조건 누락과 계산 과정을 확인한다." }),
  likert({ id: "M8", subject: "math", construct: "mathStrategy", scale: "frequency", evidenceLabel: "함께 복습", text: "지금 배우는 내용과 전에 배운 내용을 함께 복습한다." }),
  likert({ id: "M10", subject: "math", construct: "mathTestInterference", scale: "frequency", allowUnknown: true, evidenceLabel: "시험 방해감", text: "수학 시험에서 긴장하면 평소 알던 풀이 순서가 잘 떠오르지 않는다." }),
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

// ── 영어 공부 방식 보조 모듈 (10문항) ────────────────────────────────

const ENGLISH_STRATEGY: LikertItem[] = [
  likert({ id: "E1", subject: "english", construct: "englishStrategy", scale: "frequency", evidenceLabel: "간격 반복", text: "단어를 한 번에 몰아서 외우기보다 날짜를 나눠 반복한다." }),
  likert({ id: "E2", subject: "english", construct: "englishStrategy", scale: "frequency", evidenceLabel: "인출", text: "단어 뜻을 보기 전에 스스로 떠올리는 방식으로 확인한다." }),
  likert({ id: "E3", subject: "english", construct: "englishStrategy", scale: "frequency", evidenceLabel: "문맥 추론", text: "모르는 단어가 있어도 앞뒤 내용과 문장 모양을 보고 뜻을 짐작한다." }),
  likert({ id: "E4", subject: "english", construct: "englishStrategy", scale: "frequency", evidenceLabel: "문법 설명", text: "문법 문제를 맞힌 뒤에도 왜 그 답인지 설명해 본다." }),
  likert({ id: "E5", subject: "english", construct: "englishStrategy", scale: "frequency", evidenceLabel: "독해 오답", text: "독해 문제를 틀리면 글에서 답의 근거와 내가 잘못 생각한 부분을 찾는다." }),
  likert({ id: "E6", subject: "english", construct: "englishStrategy", scale: "frequency", evidenceLabel: "듣기 복구", text: "잘 안 들리는 부분은 먼저 반복해 듣고 이후 대본으로 확인한다." }),
  likert({ id: "E7", subject: "english", construct: "englishReadingAvoidance", scale: "frequency", evidenceLabel: "긴 지문", text: "긴 지문을 보면 끝까지 읽기 전에 포기하는 편이다." }),
  likert({ id: "E10", subject: "english", construct: "englishTestInterference", scale: "frequency", allowUnknown: true, evidenceLabel: "시험 방해감", text: "영어 시험에서 긴장하면 알던 단어나 문장도 잘 읽히지 않는다." }),
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

/**
 * 과목 변경 시 새 과목 범위 밖의 응답 키를 걸러낸다.
 * 남기지 않으면 제출 검증이 통과하지 못해 과목을 되돌릴 때까지 진행이 막힌다.
 */
export function pruneToSubjectScope<T>(
  values: Record<string, T>,
  selection: SubjectSelection,
): { kept: Record<string, T>; removed: string[] } {
  const allowed = new Set(getItemsForSubject(selection).map((item) => item.id));
  const kept: Record<string, T> = {};
  const removed: string[] = [];

  for (const [key, value] of Object.entries(values)) {
    if (allowed.has(key)) kept[key] = value;
    else removed.push(key);
  }

  return { kept, removed };
}

export function isLikert(item: AssessmentItem): item is LikertItem {
  return item.kind === "likert";
}

export function isScenario(item: AssessmentItem): item is ScenarioItem {
  return item.kind === "scenario";
}

export function isForcedChoice(item: AssessmentItem): item is ForcedChoiceItem {
  return item.kind === "forcedChoice";
}

/**
 * 선택지 index로 답하는 문항. 상황문항과 강제선택은 응답 형태가 같으므로
 * 저장·검증에서 같은 버킷(scenarios)을 쓴다 — 제출 payload 구조는 그대로다.
 */
export function isChoiceItem(item: AssessmentItem): item is ChoiceItem {
  return item.kind === "scenario" || item.kind === "forcedChoice";
}
