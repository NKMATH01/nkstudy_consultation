// 규칙 기반 fallback 해석 + result_profile_v2 조립 (§11-6).
// AI 호출이 실패하거나 출력이 거부되면 결정론적 점수만으로 최소 보고서를 만든다.
// 여기서 만드는 문구는 낙인 없이 band 설명 + 지도 관점으로만 서술한다.

import { interpretBand } from "./scoring";
import { ITEMS_BY_CONSTRUCT } from "./construct-guide";
import type {
  CommonScores,
  Score,
  ScoreProfile,
  SubjectSelection,
} from "./types";
import type { AiInterpretation } from "./ai-contract";

// 리포트 UI(report-theme.ts CONSTRUCT_LABEL)와 동일한 라벨(기존 라벨 유지).
const CONSTRUCT_LABEL_KO: Record<keyof CommonScores, string> = {
  learningAttitude: "수업 준비·참여",
  homeworkReliability: "숙제 시작·마무리",
  helpSeeking: "질문·도움 요청",
  feedbackExecution: "고친 뒤 다시 해보기",
  phoneBoundary: "공부 중 휴대폰 조절",
  longTermPersistence: "계획 이어가기",
  shortTermRecovery: "틀린 뒤 다시 시작",
  peerLearningResource: "또래 학습 자원",
  peerFocusBoundary: "친구와 집중 흔들림",
  reflectiveProcessingNeed: "숙고 처리 선호",
  directFeedbackAcceptance: "바로 말해 주는 방식 선호",
  relationshipSafetyNeed: "관계 안전 요구",
  autonomyNeed: "자율성 요구",
  structureNeed: "구조 요구",
  conscientiousness: "학습 성실성",
};

function isNum(s: Score): s is number {
  return typeof s === "number";
}

/** 응답 품질이 review이면 중립적 확인 문구, 아니면 빈 문자열. */
export function neutralQualityNote(profile: ScoreProfile): string {
  return profile.responseQuality.status === "review"
    ? "입학 상담에서 응답 의미 확인 필요"
    : "";
}

/** 점수가 높은 순으로 상위 라벨 추출(강점 후보). */
function rankConstructs(
  common: CommonScores,
  keys: Array<keyof CommonScores>
): Array<{ key: keyof CommonScores; label: string; score: number }> {
  return keys
    .map((k) => ({ key: k, score: common[k] }))
    .filter((e): e is { key: keyof CommonScores; score: number } =>
      isNum(e.score)
    )
    .map((e) => ({ key: e.key, label: CONSTRUCT_LABEL_KO[e.key], score: e.score }));
}

/**
 * 강점·개선 영역의 점수 인용 표기.
 * 100점 환산("82.5점")은 지표 표기 규칙에서 금지라 5점 만점 평균으로 쓴다.
 */
function averageNotation(key: keyof CommonScores, score: number): string {
  const count = ITEMS_BY_CONSTRUCT[key]?.length ?? 0;
  const average = (score / 20).toFixed(1);
  return count > 1 ? `${count}문항 평균 ${average}/5` : `평균 ${average}/5`;
}

/**
 * 결정론적 점수로 규칙 기반 최소 해석을 만든다.
 * 반환 shape는 AiInterpretation과 동일해 AI 성공 경로와 렌더러를 공유한다.
 */
export function buildFallbackInterpretation(
  profile: ScoreProfile
): AiInterpretation {
  const c = profile.common;
  const behaviorKeys: Array<keyof CommonScores> = [
    "learningAttitude",
    "homeworkReliability",
    "helpSeeking",
    "feedbackExecution",
    "phoneBoundary",
    "longTermPersistence",
    "shortTermRecovery",
  ];
  const ranked = rankConstructs(c, behaviorKeys).sort(
    (a, b) => b.score - a.score
  );
  const strengths = ranked
    .filter((e) => e.score >= 60)
    .slice(0, 3)
    .map((e) => `${e.label}: ${interpretBand(e.score)} (${averageNotation(e.key, e.score)})`);
  const growthAreas = [...ranked]
    .reverse()
    .filter((e) => e.score < 60)
    .slice(0, 3)
    .map((e) => `${e.label}: ${interpretBand(e.score)} (${averageNotation(e.key, e.score)})`);

  const note = neutralQualityNote(profile);
  const noteSuffix = note ? ` (${note})` : "";

  // 총평은 숫자를 쓰지 않는다(§자세한 총평 규칙). AI 출력이 거부되면 이 fallback이
  // 그대로 학부모 화면에 나가므로, 여기서도 점수를 문장에 넣지 않는다.
  const conscientiousnessPlain = isNum(c.conscientiousness)
    ? `학습 태도와 숙제, 목표를 향한 꾸준함을 함께 보면 ${plainLevel(
        c.conscientiousness
      )}.`
    : "학습 리듬은 응답이 부족해 상담에서 함께 확인하면 좋겠어요.";

  const strongest = ranked[0];
  const supportFirst = ranked.length ? ranked[ranked.length - 1] : null;
  const behaviorSummary = strongest && supportFirst
    ? `${strongest.label} 응답은 비교적 안정적이고, ${supportFirst.label}은 입학 상담에서 먼저 확인할 부분이에요.`
    : "응답만으로 분명한 순서를 정하기 어려워 첫 수업에서 함께 확인하면 좋겠어요.";

  const detailedSummary = [
    "학생이 직접 작성한 응답을 바탕으로 기본 요약을 정리했어요.",
    conscientiousnessPlain,
    strengths.length
      ? `잘하고 있는 부분은 ${strengths.map((s) => s.split(":")[0]).join(", ")}이에요.`
      : "뚜렷한 강점을 아직 꼽기 어려워 입학 상담에서 구체적인 공부 경험을 더 물어보면 좋겠어요.",
    growthAreas.length
      ? `처음에 도와주면 좋은 부분은 ${growthAreas
          .map((s) => s.split(":")[0])
          .join(", ")}이에요.`
      : "",
    "학업 수준과 과목별 시작점은 별도의 입학테스트 결과를 함께 봐야 더 정확해요.",
    `모두 학생이 이번에 직접 쓴 응답을 바탕으로 한 입학 상담 자료예요.${noteSuffix}`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    studentType: behaviorSummary,
    detailedSummary,
    coreObservation: behaviorSummary,
    operatingCause:
      "점수만으로 이유를 단정하긴 어려워요. 입학테스트 풀이와 상담 내용을 함께 보며 원인을 확인하면 좋겠어요.",
    recommendedCoaching: "등록이 결정되면 설명 뒤 짧은 확인 문제를 풀게 하고, 필수 과제와 선택 과제를 나누어 제시하는 방식부터 시작해 주세요.",
    verificationPlan14Days: buildVerificationPlan(profile),
    teacherBrief: [
      behaviorSummary,
      "설명 뒤 학생이 자기 말이나 한 문제 풀이로 이해를 보여 주게 해 주세요.",
      "입학 상담에서 학생이 가장 도움받고 싶은 점과 피하고 싶은 수업 조건을 확인해 주세요.",
      ...(note ? [`응답이 한쪽으로 치우쳐, 상담에서 문항 뜻과 실제 경험을 다시 확인해 주세요.`] : []),
    ],
    strengths: strengths.length ? strengths : ["입학 상담에서 구체적인 공부 경험을 더 확인할게요"],
    growthAreas: growthAreas.length
      ? growthAreas
      : ["입학 상담에서 가장 먼저 도움받고 싶은 부분을 확인할게요"],
    crossEvidence: buildCrossEvidence(profile),
    nkFitInterpretation: "등록 적합도를 확정하는 결과가 아닙니다. 학생의 일정, 이전 학원 경험, 질문 방식과 과제 관리 요구를 입학 상담에서 확인해 초기 수업 조건을 제안합니다.",
    mathStrategy: buildSubjectStrategy(profile, "math"),
    englishStrategy: buildSubjectStrategy(profile, "english"),
    roadmap12Weeks: [
      {
        weeks: "등록 후 초기",
        focus: "상담에서 합의한 시작 방식 적용",
        actions: [
          "입학테스트 오답과 상담 우선순위 연결",
          "가장 필요한 지원 한 가지부터 적용",
        ],
      },
      {
        weeks: "수업 적응 후",
        focus: "과제와 피드백 방식 조정",
        actions: ["유지되는 루틴 강화", "오답 복구·재시작 습관 점검"],
      },
      {
        weeks: "기초 루틴 형성 후",
        focus: "학생의 선택과 책임 확대",
        actions: ["확인 주기 완화 시도", "목표-주간 계획 연결 재점검"],
      },
    ],
    parentSummary:
      "{{학생}}이 입학테스트 전에 직접 쓴 응답으로 현재의 공부 습관을 정리했어요. 학업 수준은 과목 입학테스트와 함께 보고, 낮은 응답은 입학 상담에서 먼저 물어볼 부분으로 봐 주세요.",
    cautions: note
      ? [`응답에 추가 확인 신호가 있어, 입학 상담에서 문항 뜻과 실제 경험을 다시 확인해야 해요.`]
      : [],
  };
}

/** 총평용 무숫자 수준 표현. 점수를 말하지 않고 학습 리듬으로 바꿔 쓴다. */
function plainLevel(score: number): string {
  if (score >= 75) return "학습 리듬이 대체로 안정적으로 유지되고 있어요";
  if (score >= 60) return "학습 리듬이 잡혀 있고 상황에 따라 흔들릴 때가 있어요";
  if (score >= 40) return "학습 리듬이 날에 따라 오르내리는 편이에요";
  return "학습 리듬을 잡는 데 아직 도움이 필요해요";
}

function buildVerificationPlan(profile: ScoreProfile): string[] {
  const plan = [
    "평소 숙제를 언제 시작하고 무엇 때문에 미루는지 학생에게 질문",
    "낮은 응답 영역의 구체적인 최근 사례를 입학 상담에서 확인",
  ];
  if (isNum(profile.common.phoneBoundary) && profile.common.phoneBoundary < 60) {
    plan.push("공부할 때 휴대폰을 어디에 두는지 학생·보호자에게 확인");
  }
  if (
    isNum(profile.common.shortTermRecovery) &&
    profile.common.shortTermRecovery < 60
  ) {
    plan.push("문제가 막히거나 점수가 낮았을 때 다시 시작한 경험을 질문");
  }
  return plan;
}

function buildCrossEvidence(profile: ScoreProfile): string[] {
  const out: string[] = [];
  for (const [id, ev] of Object.entries(profile.situations)) {
    if (ev.tags.length === 0) continue;
    out.push(`${ev.evidenceLabel}(${id}·${ev.choice}): ${ev.tags.join(", ")}`);
  }
  return out.slice(0, 4);
}

function buildSubjectStrategy(
  profile: ScoreProfile,
  subject: "math" | "english"
): string | null {
  if (subject === "math") {
    if (!profile.math) return null;
    return "수학 응답은 개념 설명, 풀이 시작, 오답 복구 습관을 함께 본 자기보고입니다. 과목 입학테스트에서 낯선 문제를 시작하는 방식과 오답의 원인을 함께 확인해 주세요.";
  }
  if (!profile.english) return null;
  return "영어 응답은 어휘·문법·독해 공부 습관을 함께 본 자기보고입니다. 과목 입학테스트에서 긴 지문을 시작하는 방식과 틀린 답의 근거를 함께 확인해 주세요.";
}

// ── result_profile_v2 조립 ──────────────────────────────────────────

export interface ResultProfileV2 {
  instrumentVersion: "v2";
  subjectSelection: SubjectSelection;
  /** 해석 출처: AI 성공 or 규칙 기반 fallback. */
  source: "ai" | "fallback";
  generatedAt: string;
  /** 서버 결정론적 점수(유일한 수치 진실). */
  scores: ScoreProfile;
  /** 해석(AI 또는 fallback, 동일 shape). */
  interpretation: AiInterpretation;
}

/**
 * 점수 + 해석 + 메타를 result_profile_v2로 합친다.
 * 점수는 항상 서버 값이며 해석이 덮어쓰지 않는다.
 */
export function buildResultProfileV2(params: {
  scoreProfile: ScoreProfile;
  interpretation: AiInterpretation;
  source: "ai" | "fallback";
  generatedAt?: string;
}): ResultProfileV2 {
  return {
    instrumentVersion: "v2",
    subjectSelection: params.scoreProfile.subjectSelection,
    source: params.source,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    scores: params.scoreProfile,
    interpretation: params.interpretation,
  };
}
