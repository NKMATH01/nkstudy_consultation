// 규칙 기반 fallback 해석 + result_profile_v2 조립 (§11-6).
// AI 호출이 실패하거나 출력이 거부되면 결정론적 점수만으로 최소 보고서를 만든다.
// 여기서 만드는 문구는 낙인 없이 band 설명 + 지도 관점으로만 서술한다.

import { interpretBand } from "./scoring";
import type {
  CommonScores,
  Score,
  ScoreProfile,
  SubjectSelection,
} from "./types";
import type { AiInterpretation } from "./ai-contract";

// 리포트 UI(report-theme.ts CONSTRUCT_LABEL)와 동일한 쉬운 말 라벨을 사용한다.
const CONSTRUCT_LABEL_KO: Record<keyof CommonScores, string> = {
  learningAttitude: "수업에 임하는 태도",
  homeworkReliability: "숙제를 해오는 힘",
  phoneBoundary: "휴대폰 조절력",
  longTermPersistence: "목표를 오래 붙드는 힘",
  shortTermRecovery: "흔들린 뒤 다시 시작하는 힘",
  peerLearningResource: "친구와 함께 공부하는 힘",
  peerFocusBoundary: "친구 사이에서 집중을 지키는 힘",
  reflectiveProcessingNeed: "혼자 차분히 정리하는 편",
  directFeedbackAcceptance: "직설적인 피드백을 받아들이는 힘",
  relationshipSafetyNeed: "편안한 관계가 필요한 정도",
  autonomyNeed: "스스로 정하고 싶은 정도",
  structureNeed: "정해진 틀을 선호하는 정도",
  conscientiousness: "성실하게 공부하는 힘",
};

function isNum(s: Score): s is number {
  return typeof s === "number";
}

/** 응답 품질이 review이면 중립적 확인 문구, 아니면 빈 문자열. */
export function neutralQualityNote(profile: ScoreProfile): string {
  return profile.responseQuality.status === "review"
    ? "첫 14일 행동 확인 필요"
    : "";
}

/** 점수가 높은 순으로 상위 라벨 추출(강점 후보). */
function rankConstructs(
  common: CommonScores,
  keys: Array<keyof CommonScores>
): Array<{ label: string; score: number }> {
  return keys
    .map((k) => ({ key: k, score: common[k] }))
    .filter((e): e is { key: keyof CommonScores; score: number } =>
      isNum(e.score)
    )
    .map((e) => ({ label: CONSTRUCT_LABEL_KO[e.key], score: e.score }));
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
    "phoneBoundary",
    "longTermPersistence",
    "shortTermRecovery",
    "peerLearningResource",
  ];
  const ranked = rankConstructs(c, behaviorKeys).sort(
    (a, b) => b.score - a.score
  );
  const strengths = ranked
    .filter((e) => e.score >= 60)
    .slice(0, 3)
    .map((e) => `${e.label}: ${interpretBand(e.score)} (${e.score.toFixed(1)}점)`);
  const growthAreas = [...ranked]
    .reverse()
    .filter((e) => e.score < 60)
    .slice(0, 3)
    .map((e) => `${e.label}: ${interpretBand(e.score)} (${e.score.toFixed(1)}점)`);

  const note = neutralQualityNote(profile);
  const noteSuffix = note ? ` (${note})` : "";

  const conscientiousnessText = isNum(c.conscientiousness)
    ? `성실하게 공부하는 힘은 ${c.conscientiousness.toFixed(1)}점이에요. 수업에 임하는 태도 ${scoreText(
        c.learningAttitude
      )}, 숙제를 해오는 힘 ${scoreText(c.homeworkReliability)}, 목표를 오래 붙드는 힘 ${scoreText(
        c.longTermPersistence
      )}을 함께 본 값이에요.`
    : "성실하게 공부하는 힘은 응답이 부족해 상담에서 함께 확인하면 좋겠어요.";

  const detailedSummary = [
    "학생이 직접 작성한 응답을 바탕으로 기본 요약을 정리했어요.",
    conscientiousnessText,
    `지도할 때 참고할 점은 ${profile.coaching.coachingType} · ${profile.coaching.autonomyStructureType}이에요.`,
    `NK 운영 방식과는 "${profile.nkFit.stage}" 관계예요.`,
    strengths.length
      ? `잘하고 있는 부분은 ${strengths.map((s) => s.split(":")[0]).join(", ")}이에요.`
      : "뚜렷한 강점을 아직 꼽기 어려워 처음 몇 주간 함께 살펴보면 좋겠어요.",
    growthAreas.length
      ? `처음에 도와주면 좋은 부분은 ${growthAreas
          .map((s) => s.split(":")[0])
          .join(", ")}이에요.`
      : "",
    `모든 점수는 학생이 쓴 최근 4주 응답이고, 첫 2주 동안 실제 모습으로 함께 확인해 나가요.${noteSuffix}`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    studentType: `${profile.coaching.coachingType} 학생`,
    detailedSummary,
    coreObservation: `이 학생을 지도할 때 가장 참고할 점은 ${profile.coaching.coachingType}이에요. ${conscientiousnessText}`,
    operatingCause:
      "점수만으로 이유를 단정하긴 어려워요. 첫 수업과 초기 과제를 보며 원인을 함께 확인하면 좋겠어요.",
    recommendedCoaching: `${profile.coaching.coachingType}에 맞게 말하는 방식을 조금 바꾸고, ${profile.coaching.autonomyStructureType} 특성을 고려해 정해진 틀과 선택권의 균형을 잡아 주세요.`,
    verificationPlan14Days: buildVerificationPlan(profile),
    teacherBrief: [
      `지도할 때 참고할 유형은 ${profile.coaching.coachingType}이에요.`,
      `${profile.coaching.autonomyStructureType} 특성이 있어요.`,
      `NK 운영 방식과는 "${profile.nkFit.stage}" 관계예요.`,
      ...(note ? [`응답이 한쪽으로 치우쳐, 첫 2주 실제 모습으로 함께 확인하면 좋아요.`] : []),
    ],
    strengths: strengths.length ? strengths : ["처음 몇 주간 살펴본 뒤 강점을 정리할게요"],
    growthAreas: growthAreas.length
      ? growthAreas
      : ["처음 몇 주간 살펴본 뒤 도와줄 부분을 정리할게요"],
    crossEvidence: buildCrossEvidence(profile),
    nkFitInterpretation: `NK 운영 방식과는 "${profile.nkFit.stage}" 관계예요. 합격·불합격을 가리는 게 아니라, 학원이 어떤 부분을 도와주면 학생과 잘 맞을지 함께 보는 값이에요.`,
    mathStrategy: buildSubjectStrategy(profile, "math"),
    englishStrategy: buildSubjectStrategy(profile, "english"),
    roadmap12Weeks: [
      {
        weeks: "1~4주",
        focus: "초기 구조 형성과 행동 확인",
        actions: [
          "첫 14일 행동 지표를 담임이 직접 확인",
          "가장 낮은 신호 영역에 짧은 확인 주기 적용",
        ],
      },
      {
        weeks: "5~8주",
        focus: "루틴 안정화",
        actions: ["유지되는 루틴 강화", "오답 복구·재시작 습관 점검"],
      },
      {
        weeks: "9~12주",
        focus: "자립도 확대",
        actions: ["확인 주기 완화 시도", "목표-주간 계획 연결 재점검"],
      },
    ],
    parentSummary:
      "아이가 직접 작성한 응답을 바탕으로 학습 성향을 정리했어요. 지금 점수는 최근 4주 동안의 모습이고, 처음 2주 동안 학원과 가정이 함께 실제 행동을 살펴보며 맞춰 나갈게요. 부족해 보이는 부분도 혼내야 할 점이 아니라 먼저 도와줄 부분으로 봐 주시면 좋겠습니다.",
    cautions: note
      ? [`응답이 한쪽으로 치우쳐 있어, 지금 점수는 확정이 아니라 첫 2주 동안 함께 확인할 부분이에요.`]
      : [],
  };
}

function scoreText(s: Score): string {
  // §8.1 일관된 반올림: 소수 첫째 자리로 고정 표기.
  return isNum(s) ? `${s.toFixed(1)}점` : "정보 부족";
}

function buildVerificationPlan(profile: ScoreProfile): string[] {
  const plan = [
    "숙제 시작 시각과 기한 준수 여부를 첫 2주간 기록",
    "낮은 점수 영역에서 실제 행동이 점수와 일치하는지 확인",
  ];
  if (isNum(profile.common.phoneBoundary) && profile.common.phoneBoundary < 60) {
    plan.push("공부 시작 시 휴대폰 분리 습관 관찰");
  }
  if (
    isNum(profile.common.shortTermRecovery) &&
    profile.common.shortTermRecovery < 60
  ) {
    plan.push("낮은 점수·막힘 직후 재시작까지 걸리는 시간 관찰");
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
    return `수학 학습전략 ${scoreText(
      profile.math.mathStrategy
    )}. 낯선 유형 회피 신호 ${scoreText(
      profile.math.mathNoveltyAvoidance
    )}, 시험 방해감 ${scoreText(
      profile.math.mathTestInterference
    )}는 높을수록 지원이 필요한 위험 신호입니다.`;
  }
  if (!profile.english) return null;
  return `영어 학습전략 ${scoreText(
    profile.english.englishStrategy
  )}. 긴 지문 회피 신호 ${scoreText(
    profile.english.englishReadingAvoidance
  )}, 시험 방해감 ${scoreText(
    profile.english.englishTestInterference
  )}는 높을수록 지원이 필요한 위험 신호입니다.`;
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
