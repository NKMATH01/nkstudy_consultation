// 설문 V2 문항 정의 (typed definition) — v2.3 "결과지 질문 아홉 개" 구성.
// 문항표: docs/assessment-v2.3-blueprint-2026-09-04.md §2. 문장은 그 표와 글자 그대로 일치해야 한다.
// 공통 36문항(리커트) + 직접 질문 2개(MA5 상황형 · CR5 강제선택) + 수학 10 / 영어 10.
//
// ID 규칙: 공통은 두 글자 코드(LA·HW·GO·RC·MA·CR·QI·PH·PF)다. v2.2 이전의 한 글자 코드(LT·H·Q·FB·P·G·B·R·F·C)와
// 영어 모듈(E1~)이 겹치지 않도록 한 것이다. 옛 코드는 RETIRED_ITEM_IDS에 두어 설문 도중 배포된 응답을 조용히 버린다.
// 문항표의 A~H 글자는 문서 표기이고, 저장·채점 ID는 아래 두 글자 코드다(A→LA, B→HW, C→GO, D→RC, E→MA, F→CR, G→QI, H→PH·PF).

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
 * 과거 38+11+12(v2.1) · 40+10+10(v2.2) 응답과 새 36+2+10(v2.3) 응답을 통계에서 섞지 않는다.
 */
export const INSTRUMENT_REVISION = "v2.3-nine-questions-46" as const;

/** 8.7.1 고정 역채점 ID. definition.direction과 반드시 일치해야 한다. 척도당 1개. */
export const REVERSE_IDS: ReadonlySet<string> = new Set([
  "LA4",
  "GO4",
  "RC2",
  "MA4",
  "CR2",
  "QI4",
  "PH2",
  "PF1",
]);

/** 8.1 유효응답 최소 비율. 미만이면 해당 composite는 insufficient(관리 수용은 예외 — scoring 참조). */
export const MIN_VALID_RATIO = 0.75;

/**
 * 폐기된 문항 ID. 정의에서는 지웠지만 이미 학생 브라우저에 저장돼 있을 수 있어
 * 제출 검증이 "허용되지 않은 문항"으로 막지 않고 조용히 버린다.
 * (설문 도중 배포되면 저장된 응답에 남아 있다.) v2.1·v2.2의 공통 문항 전부가 여기 있다.
 */
export const RETIRED_ITEM_IDS: ReadonlySet<string> = new Set([
  // v2.1 → v2.2에서 폐기
  "M5", "M9", "E8", "E9", "R3-1", "R3-2", "N1", "N2", "N3", "N4",
  // v2.2 → v2.3에서 폐기(공통 40 + 상황문항 2 + 강제선택 R2)
  "LT1", "LT2", "LT3", "LT4",
  "H1", "H2", "H3", "H4",
  "Q1", "Q2", "Q3", "Q4",
  "FB1", "FB2", "FB3", "FB4",
  "P1", "P2", "P3", "P4",
  "G1", "G2", "G3", "G4",
  "B1", "B2", "B3", "B4",
  "R1", "R2", "R3", "R4", "R5", "R6",
  "F1", "F2", "F3", "F4",
  "C1", "C2",
]);

/** 직접 질문 ID. 점수에 넣지 않고 판정에 원문 그대로 쓴다. */
export const MANAGEMENT_DIRECT_ID = "MA5" as const;
export const GUIDANCE_CHOICE_ID = "CR5" as const;

/** 현재 학습의 어려운 점(과목별 다중선택, 최대 3). 점수 없음 — 결과지에 고른 것을 그대로 싣는다. */
export const DIFFICULTY_TAG_OPTIONS = [
  "개념이 이해 안 됨",
  "아는데 문제에 못 씀",
  "계산·풀이 실수",
  "시간이 모자람",
  "서술형·증명",
  "외우기",
  "시험만 보면 긴장",
  "앞 학년 기초 부족",
] as const;
export const DIFFICULTY_TAG_MAX = 3;

// 내부 헬퍼: 문구를 간결하게 유지하기 위한 Likert 팩토리.
function likert(
  item: Pick<
    LikertItem,
    "id" | "subject" | "construct" | "scale" | "text" | "evidenceLabel"
  > &
    Partial<Pick<LikertItem, "weight" | "required" | "allowUnknown" | "recall" | "supplement">>
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

// ── 공통 학습성향 영역 (36문항 + 직접 질문 2) ────────────────────────

// A. 학습 태도 — 공부를 얼마나 열심히 하는가
const LEARNING_ATTITUDE: LikertItem[] = [
  likert({ id: "LA1", subject: "common", construct: "learningAttitude", scale: "frequency", evidenceLabel: "수업 표시", text: "수업을 들으며 중요한 것을 적거나 표시한다." }),
  likert({ id: "LA2", subject: "common", construct: "learningAttitude", scale: "frequency", evidenceLabel: "스스로 공부", text: "학교·학원 수업 말고 하루 1시간 이상 스스로 공부한다." }),
  likert({ id: "LA3", subject: "common", construct: "learningAttitude", scale: "frequency", evidenceLabel: "그날 복습", text: "그날 배운 것을 그날 다시 본다." }),
  likert({ id: "LA4", subject: "common", construct: "learningAttitude", scale: "frequency", evidenceLabel: "딴짓 안 함", text: "공부하다 딴짓으로 시간을 보낸다." }),
];

// B. 숙제 태도 — 숙제를 열심히 하는가
const HOMEWORK: LikertItem[] = [
  likert({ id: "HW1", subject: "common", construct: "homeworkReliability", scale: "frequency", evidenceLabel: "스스로 품", text: "답을 베끼지 않고 스스로 푼다." }),
  likert({ id: "HW2", subject: "common", construct: "homeworkReliability", scale: "frequency", evidenceLabel: "기한 지킴", text: "숙제를 기한 안에 낸다." }),
  likert({ id: "HW3", subject: "common", construct: "homeworkReliability", scale: "frequency", evidenceLabel: "제출 전 확인", text: "숙제를 내기 전에 빠진 것을 확인한다." }),
  likert({ id: "HW4", subject: "common", construct: "homeworkReliability", scale: "frequency", allowUnknown: true, evidenceLabel: "오답 다시 풀기", text: "틀린 문제를 고쳐서 다시 푼다." }),
];

// C. 목표 의식 — 구체적인 목표가 있는가
const GOAL: LikertItem[] = [
  likert({ id: "GO1", subject: "common", construct: "goalClarity", scale: "agreement", evidenceLabel: "목표 점수", text: "이번 시험의 목표 점수를 말할 수 있다." }),
  likert({ id: "GO2", subject: "common", construct: "goalClarity", scale: "frequency", evidenceLabel: "주간 계획", text: "이번 주에 할 공부를 미리 정해 둔다." }),
  likert({ id: "GO3", subject: "common", construct: "goalClarity", scale: "agreement", evidenceLabel: "공부 이유", text: "왜 공부하는지 스스로 말할 수 있다." }),
  likert({ id: "GO4", subject: "common", construct: "goalClarity", scale: "agreement", evidenceLabel: "스스로 정함", text: "목표 없이 시키는 대로만 한다." }),
];

// D. 단기 회복력 — 강사가 힘들게 시켜도 따라올 것인가
const RECOVERY: LikertItem[] = [
  likert({ id: "RC1", subject: "common", construct: "shortTermRecovery", scale: "frequency", evidenceLabel: "스스로 시도", text: "어려워도 해설을 보기 전에 스스로 해 본다." }),
  likert({ id: "RC2", subject: "common", construct: "shortTermRecovery", scale: "frequency", allowUnknown: true, evidenceLabel: "낮은 점수 뒤", text: "점수가 낮게 나오면 다음 공부를 미룬다." }),
  likert({ id: "RC3", subject: "common", construct: "shortTermRecovery", scale: "frequency", allowUnknown: true, evidenceLabel: "다시 시작", text: "틀렸다는 설명을 들으면 그날 다시 시작한다." }),
  likert({ id: "RC4", subject: "common", construct: "shortTermRecovery", scale: "frequency", evidenceLabel: "힘든 과제", text: "양이 많고 힘든 과제도 끝까지 낸다." }),
  likert({ id: "RC5", subject: "common", construct: "shortTermRecovery", scale: "frequency", allowUnknown: true, evidenceLabel: "더 시켜도 함", text: "선생님이 더 하라고 하면 싫어도 한다." }),
];

// E. 관리 수용 — 철저한 관리를 버틸 수 있는가
// MA1·MA2는 "그런 상황이 있었을 때"를 기준으로 답한다. 상황이 없었으면 경험 없음(점수 분모에서 뺀다).
const MANAGEMENT: LikertItem[] = [
  likert({ id: "MA1", subject: "common", construct: "managementAcceptance", scale: "frequency", allowUnknown: true, recall: "ever", evidenceLabel: "남아서 함", text: "숙제를 안 해 와서 남으라고 하면 남아서 한다." }),
  likert({ id: "MA2", subject: "common", construct: "managementAcceptance", scale: "frequency", allowUnknown: true, recall: "ever", evidenceLabel: "시험 준비", text: "매주 보는 시험 준비를 시키는 대로 했다." }),
  likert({ id: "MA3", subject: "common", construct: "managementAcceptance", scale: "agreement", evidenceLabel: "매일 확인 필요", text: "선생님이 매일 확인해 주는 것이 나에게 필요하다." }),
  likert({ id: "MA4", subject: "common", construct: "managementAcceptance", scale: "agreement", evidenceLabel: "검사 부담", text: "검사와 지적이 많으면 다니기 싫어진다." }),
];

/** E5 직접 질문. 점수에 넣지 않고 학생이 고른 답을 판정에 그대로 쓴다. */
const MANAGEMENT_DIRECT: ScenarioItem[] = [
  {
    id: MANAGEMENT_DIRECT_ID,
    kind: "scenario",
    subject: "common",
    evidenceLabel: "버틸 수 있는가",
    text: "NK는 숙제 검사, 매주 테스트, 못 하면 남아서 보충하는 관리가 있어서 조금 힘들 수 있어요. 버틸 수 있겠어요?",
    options: [
      { index: 1, choice: "A", text: "버틸 수 있다", tags: ["endure_yes"] },
      { index: 2, choice: "B", text: "힘들어도 해 보겠다", tags: ["endure_try"] },
      { index: 3, choice: "C", text: "잘 모르겠다", tags: ["endure_unsure"] },
      { index: 4, choice: "D", text: "힘들 것 같다", tags: ["endure_no"] },
    ],
  },
];

// F. 지도 방식 반응 — 강하게 밀어도 되는가, 차분히 다독여야 하는가
// CR4는 세게 지적받는 것을 견디는지를 묻는다. 잘한 점을 먼저 말해 주길 바라는 쪽은 CR5 강제선택에서 본다.
const COACHING_RESPONSE: LikertItem[] = [
  likert({ id: "CR1", subject: "common", construct: "coachingResponse", scale: "frequency", allowUnknown: true, evidenceLabel: "세게 지적 뒤", text: "선생님이 세게 지적하면 다음에 더 열심히 한다." }),
  likert({ id: "CR2", subject: "common", construct: "coachingResponse", scale: "frequency", allowUnknown: true, evidenceLabel: "혼난 뒤 회피", text: "크게 혼난 뒤 그 과목이 싫어져 안 하게 된다." }),
  likert({ id: "CR3", subject: "common", construct: "coachingResponse", scale: "agreement", evidenceLabel: "바로 말해 주기", text: "고칠 점을 바로 말해 주는 게 편하다." }),
  likert({ id: "CR4", subject: "common", construct: "coachingResponse", scale: "agreement", evidenceLabel: "기분 회복", text: "세게 지적받아도 기분이 오래 상하지 않는다." }),
];

/** F5 강제선택. 점수에 넣지 않고 "어느 선생님을 골랐는지"로만 쓴다. A=세게, B=차분히. */
const COACHING_CHOICE: ForcedChoiceItem[] = [
  {
    id: GUIDANCE_CHOICE_ID,
    kind: "forcedChoice",
    subject: "common",
    construct: "coachingChoice",
    required: true,
    evidenceLabel: "고른 선생님",
    text: "두 선생님 중 누구에게 더 잘 배울 것 같아요?",
    options: [
      { index: 1, choice: "A", text: "틀린 것을 바로 세게 짚어 주는 선생님", score: 100 },
      { index: 2, choice: "B", text: "먼저 잘한 점을 말하고 차분히 고쳐 주는 선생님", score: 0 },
    ],
  },
];

// G. 질문 성향 — 활기차게 질문하는 편인가
const QUESTION: LikertItem[] = [
  likert({ id: "QI1", subject: "common", construct: "questionInitiative", scale: "frequency", allowUnknown: true, evidenceLabel: "바로 손 듦", text: "모르면 바로 손을 들고 물어본다." }),
  likert({ id: "QI2", subject: "common", construct: "questionInitiative", scale: "frequency", allowUnknown: true, evidenceLabel: "새 반 질문", text: "새 반에서도 먼저 질문한다." }),
  likert({ id: "QI3", subject: "common", construct: "questionInitiative", scale: "frequency", evidenceLabel: "소리 내 답", text: "수업 중 답을 소리 내어 말한다." }),
  likert({ id: "QI4", subject: "common", construct: "questionInitiative", scale: "frequency", evidenceLabel: "넘어가지 않음", text: "물어볼 것이 있어도 그냥 넘어간다." }),
];

// H. 학습 방해 — 휴대폰 4 · 친구 3 (점수는 따로 낸다)
const PHONE: LikertItem[] = [
  likert({ id: "PH1", subject: "common", construct: "phoneBoundary", scale: "frequency", allowUnknown: true, evidenceLabel: "시작 전 치움", text: "공부 전에 휴대폰을 안 보이는 곳에 둔다." }),
  likert({ id: "PH2", subject: "common", construct: "phoneBoundary", scale: "frequency", allowUnknown: true, evidenceLabel: "습관 확인", text: "공부 중에 휴대폰을 습관처럼 열어 본다." }),
  likert({ id: "PH3", subject: "common", construct: "phoneBoundary", scale: "frequency", allowUnknown: true, evidenceLabel: "시간 정함", text: "휴대폰 쓰는 시간을 스스로 정해서 지킨다." }),
  likert({ id: "PH4", subject: "common", construct: "phoneBoundary", scale: "frequency", allowUnknown: true, evidenceLabel: "5분 복귀", text: "휴대폰을 봐도 5분 안에 공부로 돌아온다." }),
];

const PEER: LikertItem[] = [
  likert({ id: "PF1", subject: "common", construct: "peerFocusBoundary", scale: "frequency", evidenceLabel: "대화로 미룸", text: "친구와 이야기하느라 할 일을 미룬다." }),
  likert({ id: "PF2", subject: "common", construct: "peerFocusBoundary", scale: "frequency", evidenceLabel: "놀자고 해도", text: "친구가 놀자고 해도 할 일을 먼저 끝낸다." }),
  likert({ id: "PF3", subject: "common", construct: "peerFocusBoundary", scale: "frequency", evidenceLabel: "시간 지킴", text: "친구와 같이 있어도 정한 공부 시간은 지킨다." }),
];

export const COMMON_ITEMS: AssessmentItem[] = [
  ...LEARNING_ATTITUDE,
  ...HOMEWORK,
  ...GOAL,
  ...RECOVERY,
  ...MANAGEMENT,
  ...MANAGEMENT_DIRECT,
  ...COACHING_RESPONSE,
  ...COACHING_CHOICE,
  ...QUESTION,
  ...PHONE,
  ...PEER,
];

// ── 수학 공부 방식 보조 모듈 (10문항) — v2.2 그대로 ─────────────────────

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

// ── 영어 공부 방식 보조 모듈 (10문항) — v2.2 그대로 ─────────────────────

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
