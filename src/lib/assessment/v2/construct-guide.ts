// AI 프롬프트에 주입할 구인(construct) 사전.
//
// 왜 필요한가: AI가 지표를 제멋대로 번역하거나 역채점·선호축을 강점/약점으로 재분류해
// 학부모에게 잘못된 해석이 나갔다. 라벨·방향·표기 규칙을 코드 한 곳에서 만들어 프롬프트에 그대로 밀어 넣는다.
//
// 단일 원천:
//   - 한글 라벨 = report-theme.ts의 CONSTRUCT_LABEL(화면과 동일 표기 보장) + SUBJECT_CONSTRUCT_LABEL
//   - 문항 수  = definition.ts의 실제 문항 (하드코딩하지 않고 런타임 집계)

import {
  CONSTRUCT_LABEL,
  SUBJECT_CONSTRUCT_LABEL,
} from "@/components/analysis-report-v2/report-theme";
import { ALL_ITEMS, isForcedChoice, isScenario } from "./definition";

/** 구인 키 → 한글 라벨. 공통 아홉 척도 + 과목 보조 + 강제선택. */
export function constructLabelOf(key: string): string {
  return (
    (CONSTRUCT_LABEL as Record<string, string>)[key] ??
    SUBJECT_CONSTRUCT_LABEL[key] ??
    key
  );
}

/**
 * construct → 소속 문항 ID. definition.ts를 그대로 집계한다.
 * 점수를 만드는 문항(리커트·강제선택)만 센다. 상황문항은 태그만 남기고 점수가 없다.
 */
export const ITEMS_BY_CONSTRUCT: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const item of ALL_ITEMS) {
    if (isScenario(item)) continue;
    (map[item.construct] ??= []).push(item.id);
  }
  return map;
})();

/** 문항이 1개뿐인 구인. 평균이 곧 한 사람의 한 응답이라 점수로 말하면 과대 해석이 된다. */
export const SINGLE_ITEM_CONSTRUCTS: string[] = Object.entries(ITEMS_BY_CONSTRUCT)
  .filter(([, items]) => items.length === 1)
  .map(([construct]) => construct);

export function isSingleItemConstruct(construct: string): boolean {
  return (ITEMS_BY_CONSTRUCT[construct]?.length ?? 0) === 1;
}

/**
 * 강제선택 문항으로 재는 구인. 값이 양 끝(0/100)으로만 나오므로
 * "정도"가 아니라 "어느 쪽을 골랐는지"로만 서술해야 한다.
 */
export const FORCED_CHOICE_CONSTRUCTS: string[] = (() => {
  const set = new Set<string>();
  for (const item of ALL_ITEMS) {
    if (isForcedChoice(item)) set.add(item.construct);
  }
  return [...set];
})();

/**
 * 천장 문항(top2 응답이 79%를 넘어 변별력이 없는 문항).
 * v2.3에서는 옛 LT1·R1을 뺐다. 새 문항의 운영 응답이 쌓이면 다시 채운다.
 */
export const CEILING_ITEMS: string[] = [];

type Direction = "positive" | "risk" | "preference";

interface ConstructGuide {
  definition: string;
  direction: Direction;
  /** 높을수록 무엇인지 한 줄 */
  highMeans: string;
}

/**
 * 방향 정의.
 * - positive: 높을수록 잘 되고 있는 신호
 * - risk: 높을수록 "지원이 필요한 신호". 낮다고 우수한 것이 아니다.
 * - preference: 높을수록 그 방식이 맞는다는 뜻일 뿐 우열이 아니다.
 */
export const CONSTRUCT_GUIDE: Record<string, ConstructGuide> = {
  learningAttitude: {
    definition: "수업 중 표시·그날 복습·스스로 공부하는 시간처럼 공부를 열심히 하는 행동",
    direction: "positive",
    highMeans: "열심히 하는 습관이 자리 잡음",
  },
  homeworkReliability: {
    definition: "답을 베끼지 않고 스스로 풀어 기한 안에 내고 틀린 문제를 다시 푸는 행동",
    direction: "positive",
    highMeans: "숙제를 스스로 끝까지 함",
  },
  goalClarity: {
    definition: "목표 점수와 공부 이유를 말할 수 있고 이번 주 할 일을 미리 정하는 정도",
    direction: "positive",
    highMeans: "목표가 뚜렷하고 계획으로 이어짐",
  },
  shortTermRecovery: {
    definition: "낮은 점수·힘든 과제·더 시키는 요구 뒤에도 다시 시작하고 끝까지 하는 힘",
    direction: "positive",
    highMeans: "힘들게 시켜도 따라옴",
  },
  managementAcceptance: {
    definition: "남아서 하기·매주 시험 준비·매일 확인 같은 철저한 관리를 받아들이는 정도",
    direction: "positive",
    highMeans: "철저한 관리를 버틸 수 있음",
  },
  coachingResponse: {
    definition: "세게 지적받았을 때 더 열심히 하고 기분이 오래 상하지 않는 정도",
    direction: "preference",
    highMeans: "강하게 말해도 따라옴 (낮으면 차분히 다독여야 함)",
  },
  questionInitiative: {
    definition: "모르면 바로 손을 들고 수업 중 소리 내어 답하는 정도",
    direction: "positive",
    highMeans: "활기차게 먼저 묻는 편",
  },
  phoneBoundary: {
    definition: "공부할 때 휴대폰을 치우고 쓰는 시간을 스스로 정해 지키는 정도",
    direction: "positive",
    highMeans: "휴대폰에 흔들리지 않음",
  },
  peerFocusBoundary: {
    definition: "친구가 옆에 있어도 할 일을 먼저 끝내는 정도",
    direction: "positive",
    highMeans: "친구가 있어도 할 일을 함",
  },
  mathStrategy: {
    definition: "수학을 공부하는 방법의 짜임새",
    direction: "positive",
    highMeans: "수학 공부 방법이 잡혀 있음",
  },
  mathNoveltyAvoidance: {
    definition: "처음 보는 유형을 피하려는 정도",
    direction: "risk",
    highMeans: "낯선 유형 앞에서 물러서기 쉬워 시작을 도와줄 필요가 있음",
  },
  mathTestInterference: {
    definition: "시험 중 긴장이 풀이를 방해하는 정도",
    direction: "risk",
    highMeans: "시험 긴장이 실력 발휘를 막아 연습이 필요함",
  },
  englishStrategy: {
    definition: "영어를 공부하는 방법의 짜임새",
    direction: "positive",
    highMeans: "영어 공부 방법이 잡혀 있음",
  },
  englishReadingAvoidance: {
    definition: "긴 지문을 피하려는 정도",
    direction: "risk",
    highMeans: "긴 글 앞에서 물러서기 쉬워 분량을 나눠 줄 필요가 있음",
  },
  englishTestInterference: {
    definition: "시험 중 긴장이 독해를 방해하는 정도",
    direction: "risk",
    highMeans: "시험 긴장이 실력 발휘를 막아 연습이 필요함",
  },
};

const DIRECTION_NOTE: Record<Direction, string> = {
  positive: "높을수록 잘 되고 있는 신호",
  risk: "높을수록 지원이 필요한 신호 (낮다고 우수한 것이 아님)",
  preference: "높을수록 그 방식이 맞는다는 뜻 (우열 아님)",
};

/** 프롬프트에 넣을 라벨·방향·문항 수 표. */
export function buildConstructDictionary(): string {
  const rows = Object.entries(CONSTRUCT_GUIDE).map(([key, guide]) => {
    const label = constructLabelOf(key);
    const items = ITEMS_BY_CONSTRUCT[key] ?? [];
    const count = items.length === 1 ? "단일문항" : `${items.length}문항`;
    return `| ${label} | ${count} | ${guide.definition} | ${DIRECTION_NOTE[guide.direction]} — ${guide.highMeans} |`;
  });

  return `| 한글 이름(이 이름만 사용) | 문항 수 | 뜻 | 방향 |
|---|---|---|---|
${rows.join("\n")}`;
}

/** 프롬프트에 넣을 표기·인용 규칙. */
export function buildNamingRules(): string {
  const singleLabels = SINGLE_ITEM_CONSTRUCTS.map(constructLabelOf);
  const forcedLabels = FORCED_CHOICE_CONSTRUCTS.map(constructLabelOf);

  const singleRule = singleLabels.length
    ? `- 다음 지표는 문항이 하나뿐이라 점수를 말하면 과대 해석이 됩니다 — 점수·평균을 절대 인용하지 말고, 문항이 묻는 내용의 요지와 학생의 응답 라벨로만 서술하세요: ${singleLabels.join(", ")}`
    : "";
  const forcedRule = forcedLabels.length
    ? `- 다음 지표는 둘 중 하나를 고르는 문항이라 "얼마나"가 없습니다 — 정도·강도로 말하지 말고 학생이 고른 보기 그대로만 쓰세요(예: "잘한 점을 먼저 말하고 차분히 고쳐 주는 선생님을 골랐습니다"): ${forcedLabels.join(", ")}`
    : "";
  const ceilingRule = CEILING_ITEMS.length
    ? `- 다음 문항은 거의 모든 학생이 높게 답해 변별력이 없습니다. 이 문항 하나만 근거로 강점을 만들지 마세요: ${CEILING_ITEMS.join(", ")}`
    : "";

  return `[지표 이름·표기 규칙 — 매우 중요]
- 위 표의 "한글 이름"으로만 지표를 지칭하세요. 다른 번역어를 새로 만들지 마세요.
- 영문 키(learningAttitude 등)·내부 코드(construct, evidence, LA1·MA5 같은 문항 ID)를 문장에 절대 쓰지 마세요.
- "역채점", "위험축", "선호축" 같은 내부 용어도 쓰지 마세요.

[방향 해석 — 매우 중요]
- 방향이 "지원이 필요한 신호"인 지표는 점수가 높다고 나쁜 학생이라는 뜻이 아니라 도와줄 지점이 있다는 뜻입니다. 이 지표를 강점으로 재분류하지 마세요.
- 방향이 "우열 아님"인 지표(지도 방식 반응)는 강점·약점 어느 쪽으로도 분류하지 마세요. "이런 방식이 맞습니다"처럼 지도 방식으로만 서술하세요.

[점수 인용 방식 — 매우 중요]
- 다문항 지표는 "5점 만점 평균"으로만 인용하세요. 표기는 "4문항 평균 1.8/5"처럼 씁니다.
- 100점 환산 수치(예: "75.0점", "81.3점")를 문장에 쓰지 마세요.
${[singleRule, forcedRule].filter(Boolean).join("\n")}

[강점 근거 제한]
${ceilingRule ? `${ceilingRule}\n` : ""}- 강점은 여러 문항이 함께 뒷받침될 때만 쓰세요.`;
}

/** studentType 생성 공식(핵심 학습행동 여덟 축 중 최고/최저 조합 — 지도 방식 반응은 우열이 아니라 제외). */
export const STUDENT_TYPE_AXES = [
  "learningAttitude",
  "homeworkReliability",
  "goalClarity",
  "shortTermRecovery",
  "managementAcceptance",
  "questionInitiative",
  "phoneBoundary",
  "peerFocusBoundary",
] as const;

export function buildStudentTypeRule(): string {
  const labels = STUDENT_TYPE_AXES.map(constructLabelOf);

  return `[studentType 작성 공식 — 매우 중요]
- 다음 여덟 축 중 가장 높은 축과 가장 낮은 축을 고르고, 그 두 축의 "행동"을 이어 붙인 한 문장으로 쓰세요: ${labels.join(", ")}
- 형식 예시: "숙제는 기한 안에 스스로 챙기지만, 낮은 점수 뒤 다시 시작까지 시간이 걸리는 학생"
- 유형명·분류명(예: 혼합 반응, 관찰형, 자기주도형)을 쓰지 마세요.
- "~한 틀", "~형", "~타입" 같은 상투구를 쓰지 마세요.
- 학생 실명을 쓰지 마세요(다른 필드와 달리 {{학생}} 토큰도 넣지 마세요 — 행동만 서술).
- 점수 수치를 넣지 마세요.`;
}
