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

const CONSTRUCT_LABEL_KO: Record<keyof CommonScores, string> = {
  learningAttitude: "학습 태도",
  homeworkReliability: "숙제 신뢰도",
  phoneBoundary: "휴대폰 자기조절",
  longTermPersistence: "장기 의지",
  shortTermRecovery: "단기 회복력",
  peerLearningResource: "또래 학습 자원",
  peerFocusBoundary: "또래 집중 경계",
  reflectiveProcessingNeed: "숙고 처리 선호",
  directFeedbackAcceptance: "직접 피드백 수용",
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
    .map((e) => `${e.label}: ${interpretBand(e.score)} (${e.score}점)`);
  const growthAreas = [...ranked]
    .reverse()
    .filter((e) => e.score < 60)
    .slice(0, 3)
    .map((e) => `${e.label}: ${interpretBand(e.score)} (${e.score}점)`);

  const note = neutralQualityNote(profile);
  const noteSuffix = note ? ` (${note})` : "";

  const conscientiousnessText = isNum(c.conscientiousness)
    ? `학습 성실성 종합 ${c.conscientiousness}점 — 학습 태도 ${scoreText(
        c.learningAttitude
      )}, 숙제 신뢰 ${scoreText(c.homeworkReliability)}, 장기 의지 ${scoreText(
        c.longTermPersistence
      )}로 구성됩니다.`
    : "학습 성실성은 유효 응답이 부족해 상담에서 직접 확인이 필요합니다.";

  const detailedSummary = [
    "AI 해석을 사용할 수 없어 서버 점수 기반 규칙 요약으로 제공합니다.",
    conscientiousnessText,
    `지도 방식 신호: ${profile.coaching.coachingType} / ${profile.coaching.autonomyStructureType}.`,
    `NK 운영 적합도: ${profile.nkFit.stage}.`,
    strengths.length
      ? `상대적 강점 신호는 ${strengths.map((s) => s.split(":")[0]).join(", ")} 영역입니다.`
      : "뚜렷한 강점 신호를 특정하기 어려워 초기 관찰이 필요합니다.",
    growthAreas.length
      ? `초기 확인이 필요한 영역은 ${growthAreas
          .map((s) => s.split(":")[0])
          .join(", ")}입니다.`
      : "",
    `모든 수치는 최근 4주 자기보고 기반이며 첫 14일 행동으로 재확인하는 것을 전제로 해석하세요.${noteSuffix}`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    studentType: `관찰 기반 프로필 (${profile.coaching.coachingType})`,
    detailedSummary,
    coreObservation: `핵심 지도 신호: ${profile.coaching.coachingType}. ${conscientiousnessText}`,
    operatingCause:
      "자기보고 점수만으로는 원인을 단정할 수 없어, 첫 수업과 초기 과제 수행으로 원인을 확인하는 것을 권합니다.",
    recommendedCoaching: `${profile.coaching.coachingType}에 맞춰 전달 방식을 조정하고, ${profile.coaching.autonomyStructureType} 특성을 고려해 구조와 선택권의 균형을 잡으세요.`,
    verificationPlan14Days: buildVerificationPlan(profile),
    teacherBrief: [
      `지도 유형: ${profile.coaching.coachingType}`,
      `자율·구조 성향: ${profile.coaching.autonomyStructureType}`,
      `NK 적합도 단계: ${profile.nkFit.stage}`,
      ...(note ? [`응답 품질: ${note}`] : []),
    ],
    strengths: strengths.length ? strengths : ["초기 관찰 후 강점 확정 필요"],
    growthAreas: growthAreas.length
      ? growthAreas
      : ["초기 관찰 후 개선 영역 확정 필요"],
    crossEvidence: buildCrossEvidence(profile),
    nkFitInterpretation: `NK 운영 적합도는 "${profile.nkFit.stage}" 단계입니다. 등록 판정이 아니라 제공해야 할 지원 조건을 함께 확인하세요.`,
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
      "학생이 작성한 학습 프로필을 바탕으로 초기 지도 방향을 정리했습니다. 수치는 최근 4주 자기보고이며, 처음 2주 동안의 실제 행동으로 함께 확인해 나갈 예정입니다.",
    cautions: note
      ? [`${note}: 초기 수치는 확정이 아니라 확인 대상으로 해석`]
      : [],
  };
}

function scoreText(s: Score): string {
  return isNum(s) ? `${s}점` : "정보 부족";
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
