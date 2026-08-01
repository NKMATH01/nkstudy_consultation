// AI 프롬프트에 주입할 구인(construct) 사전.
//
// 왜 필요한가: AI가 지표를 제멋대로 번역하거나("Reflective Processing", "숙고형 처리 요구도"),
// 역채점·선호축을 강점/약점으로 재분류해 학부모에게 잘못된 해석이 나갔다.
// 라벨·방향·표기 규칙을 코드 한 곳에서 만들어 프롬프트에 그대로 밀어 넣는다.
//
// 단일 원천:
//   - 한글 라벨 = report-theme.ts의 CONSTRUCT_LABEL (화면과 동일 표기 보장)
//   - 문항 수  = definition.ts의 실제 문항 (하드코딩하지 않고 런타임 집계)

import { CONSTRUCT_LABEL } from "@/components/analysis-report-v2/report-theme";
import { ALL_ITEMS, isForcedChoice, isScenario } from "./definition";

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
 * 이 문항 하나만 근거로 강점을 만들면 "누구나 받는 칭찬"이 된다.
 *
 * R2는 천장이라 강제선택으로 바꿨다 — 이제 top2 자체가 없어 목록에서 뺀다.
 */
export const CEILING_ITEMS = ["M9", "LT1", "R1", "N1", "N2"];

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
 * - preference: 높을수록 그 방식을 선호/필요로 한다는 뜻일 뿐 우열이 아니다.
 */
export const CONSTRUCT_GUIDE: Record<string, ConstructGuide> = {
  learningAttitude: {
    definition: "수업에 들어와 집중하고 모르는 것을 확인하는 행동",
    direction: "positive",
    highMeans: "수업 중 집중과 확인 행동이 자주 나타남",
  },
  homeworkReliability: {
    definition: "숙제를 시작하고 기한 안에 제출하는 행동",
    direction: "positive",
    highMeans: "숙제 시작과 제출이 안정적임",
  },
  phoneBoundary: {
    definition: "공부 중 휴대폰을 스스로 멀리 두는 행동",
    direction: "positive",
    highMeans: "휴대폰을 스스로 조절함",
  },
  longTermPersistence: {
    definition: "목표를 오래 유지하며 버티는 힘",
    direction: "positive",
    highMeans: "목표를 오래 붙잡고 감",
  },
  shortTermRecovery: {
    definition: "낮은 점수나 막힌 문제 뒤 다시 시작하는 속도",
    direction: "positive",
    highMeans: "실패 뒤 회복이 빠름",
  },
  conscientiousness: {
    definition: "학습 전반의 성실함(여러 축을 합친 참고값)",
    direction: "positive",
    highMeans: "전반적으로 성실한 편",
  },
  peerLearningResource: {
    definition: "친구와 함께 공부할 때 도움을 주고받는 정도",
    direction: "positive",
    highMeans: "친구 관계가 공부에 도움이 됨",
  },
  peerFocusBoundary: {
    definition: "친구가 옆에 있을 때 집중이 흔들리는 정도",
    direction: "risk",
    highMeans: "친구와 함께일 때 집중이 흔들려 자리 배치 배려가 필요함",
  },
  structureNeed: {
    definition: "정해진 순서와 점검을 필요로 하는 정도",
    direction: "preference",
    highMeans: "촘촘한 안내와 점검이 있을 때 더 잘함",
  },
  autonomyNeed: {
    definition: "스스로 정하고 싶은 정도",
    direction: "preference",
    highMeans: "선택권이 있을 때 더 잘함",
  },
  relationshipSafetyNeed: {
    definition: "편안한 관계가 먼저 필요한 정도",
    direction: "preference",
    highMeans: "관계가 편해진 뒤에 더 잘 따라옴",
  },
  reflectiveProcessingNeed: {
    definition: "생각을 정리할 시간이 필요한 정도",
    direction: "preference",
    highMeans: "즉답보다 생각할 시간을 주면 더 잘함",
  },
  directFeedbackAcceptance: {
    definition: "직접적인 지적을 받아들이는 정도",
    direction: "preference",
    highMeans: "돌려 말하기보다 분명한 피드백이 잘 맞음",
  },
  nkFit: {
    definition: "NK 운영 방식(클리닉·주간테스트 등)과의 맞물림",
    direction: "positive",
    highMeans: "NK 운영 방식과 잘 맞물림",
  },
  mathStrategy: {
    definition: "수학을 공부하는 방법의 짜임새",
    direction: "positive",
    highMeans: "수학 공부 방법이 잡혀 있음",
  },
  mathSelfEfficacy: {
    definition: "수학을 해낼 수 있다는 자신감",
    direction: "positive",
    highMeans: "수학에 자신감이 있음",
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
  englishSelfEfficacy: {
    definition: "영어를 해낼 수 있다는 자신감",
    direction: "positive",
    highMeans: "영어에 자신감이 있음",
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
  preference: "높을수록 그 방식을 선호/필요로 한다는 뜻 (우열 아님)",
};

/** 프롬프트에 넣을 라벨·방향·문항 수 표. */
export function buildConstructDictionary(): string {
  const rows = Object.entries(CONSTRUCT_GUIDE).map(([key, guide]) => {
    const label = CONSTRUCT_LABEL[key as keyof typeof CONSTRUCT_LABEL] ?? key;
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
  const label = (k: string) =>
    CONSTRUCT_LABEL[k as keyof typeof CONSTRUCT_LABEL] ?? k;
  const singleLabels = SINGLE_ITEM_CONSTRUCTS.map(label);
  const forcedLabels = FORCED_CHOICE_CONSTRUCTS.map(label);

  return `[지표 이름·표기 규칙 — 매우 중요]
- 위 표의 "한글 이름"으로만 지표를 지칭하세요. 다른 번역어를 새로 만들지 마세요.
- 영문 키(learningAttitude 등)·내부 코드(NKFit, nkFit, 상황문항, evidence, construct, R2·M9 같은 문항 ID)를 문장에 절대 쓰지 마세요.
- "역채점", "위험축", "선호축" 같은 내부 용어도 쓰지 마세요.

[방향 해석 — 매우 중요]
- 방향이 "지원이 필요한 신호"인 지표는 점수가 높다고 나쁜 학생이라는 뜻이 아니라 도와줄 지점이 있다는 뜻입니다. 이 지표를 강점으로 재분류하지 마세요.
- 방향이 "우열 아님"인 지표(선호)는 강점·약점 어느 쪽으로도 분류하지 마세요. "이런 방식이 잘 맞습니다"처럼 선호로만 서술하세요.

[점수 인용 방식 — 매우 중요]
- 다문항 지표는 "5점 만점 평균"으로만 인용하세요. 표기는 "4문항 평균 1.8/5"처럼 씁니다.
- 100점 환산 수치(예: "75.0점", "81.3점")를 문장에 쓰지 마세요.
- 다음 지표는 문항이 하나뿐이라 점수를 말하면 과대 해석이 됩니다 — 점수·평균을 절대 인용하지 말고, 문항이 묻는 내용의 요지와 학생의 응답 라벨로만 서술하세요(예: "생각을 정리할 시간이 필요하다는 문항에 '대체로 그렇다'고 답했습니다"): ${singleLabels.join(", ")}
- 다음 지표는 둘 중 하나를 고르는 문항이라 "얼마나"가 없습니다 — 정도·강도로 말하지 말고 학생이 고른 행동 그대로만 쓰세요(예: "모르는 게 생기면 수업이 끝난 뒤 따로 물어보는 쪽을 골랐습니다"): ${forcedLabels.join(", ")}

[강점 근거 제한]
- 다음 문항은 거의 모든 학생이 높게 답해 변별력이 없습니다. 이 문항 하나만 근거로 강점을 만들지 마세요: ${CEILING_ITEMS.join(", ")}
- 강점은 여러 문항이 함께 뒷받침될 때만 쓰세요.`;
}

/** studentType 생성 공식(5축 최고/최저 행동 조합). */
export const STUDENT_TYPE_AXES = [
  "learningAttitude",
  "homeworkReliability",
  "phoneBoundary",
  "longTermPersistence",
  "shortTermRecovery",
] as const;

export function buildStudentTypeRule(): string {
  const labels = STUDENT_TYPE_AXES.map(
    (k) => CONSTRUCT_LABEL[k as keyof typeof CONSTRUCT_LABEL] ?? k,
  );

  return `[studentType 작성 공식 — 매우 중요]
- 다음 다섯 축 중 가장 높은 축과 가장 낮은 축을 고르고, 그 두 축의 "행동"을 이어 붙인 한 문장으로 쓰세요: ${labels.join(", ")}
- 형식 예시: "숙제는 기한 안에 챙기지만, 낮은 점수 뒤 다시 시작까지 시간이 걸리는 학생"
- 유형명·분류명(예: 혼합 반응, 14일 관찰형, 자기주도형)을 쓰지 마세요.
- "~한 틀", "~형", "~타입" 같은 상투구를 쓰지 마세요.
- 학생 실명을 쓰지 마세요(다른 필드와 달리 {{학생}} 토큰도 넣지 마세요 — 행동만 서술).
- 점수 수치를 넣지 마세요.`;
}
