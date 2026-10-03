// 규칙 기반 fallback 해석 + result_profile_v2 조립 (§11-6).
// AI 호출이 실패하거나 출력이 거부되면 결정론적 점수만으로 최소 보고서를 만든다.
// 여기서 만드는 문구는 낙인 없이 등급 설명 + 지도 관점으로만 서술한다.
//
// v2.3: 공통 아홉 척도와 핵심 판단 두 가지(관리를 버틸 수 있는가 · 강하게 vs 다독임)를 반영한다.

import { GRADE_THRESHOLD, interpretBand } from "./scoring";
import { ITEMS_BY_CONSTRUCT } from "./construct-guide";
import { CONSTRUCT_LABEL } from "@/components/analysis-report-v2/report-theme";
import type {
  CommonScores,
  GuidanceVerdictResult,
  ManagementVerdictResult,
  Score,
  ScoreProfile,
  SubjectSelection,
} from "./types";
import type { AiInterpretation } from "./ai-contract";

function isNum(s: Score): s is number {
  return typeof s === "number";
}

/** 응답 품질이 review이면 중립적 확인 문구, 아니면 빈 문자열. */
export function neutralQualityNote(profile: ScoreProfile): string {
  return profile.responseQuality.status === "review"
    ? "입학 상담에서 응답 의미 확인 필요"
    : "";
}

// ── 핵심 판단 문장(결정론) — 결과지·강사 시트·fallback이 공유 ─────────────

/** ★ 관리를 버틸 수 있는가 — 판정별 설명 한 줄(초등학생도 아는 낱말). */
export function managementVerdictSentence(v: ManagementVerdictResult | undefined): string {
  if (!v) return "관리를 버틸 수 있는지는 응답이 부족해 상담에서 확인합니다.";
  const direct = v.directAnswer ? `본인은 "${v.directAnswer}"라고 답했습니다.` : "본인 답은 비어 있습니다.";
  switch (v.verdict) {
    case "버틸 수 있음":
      return `남아서 하라고 하면 남고, 힘든 구간에서도 다시 시작한다고 답했습니다. ${direct}`;
    case "도움이 있으면 버팀":
      return `관리를 받아들이겠다고 답했지만, 결과가 늦게 나오는 구간에서 한 번 멈추는 쪽입니다. 그 구간에서 손을 잡아 주면 버팁니다. ${direct}`;
    case "지금은 어려움":
      return `검사와 지적이 많은 관리를 힘들어하고, 힘든 뒤 다시 시작하는 응답도 낮았습니다. 첫 달은 관리 강도를 조절해 시작합니다. ${direct}`;
    default:
      return `응답이 부족해 판정을 미룹니다. 남아서 하기·매주 시험 경험을 상담에서 직접 확인합니다. ${direct}`;
  }
}

/** ★ 강하게 vs 다독임 — 판정별 설명 한 줄. */
export function guidanceVerdictSentence(v: GuidanceVerdictResult | undefined): string {
  if (!v) return "강하게 밀어도 되는지는 응답이 부족해 상담에서 확인합니다.";
  const choice = v.choiceText ? `본인은 "${v.choiceText}"을 골랐습니다.` : "";
  const confirm = v.confirmInCounseling ? " 본인 선택과 응답이 갈려 첫 상담에서 실제 사례를 확인합니다." : "";
  switch (v.verdict) {
    case "강하게 밀어도 됨":
      return `세게 지적받으면 더 열심히 하고 기분이 오래 상하지 않는다고 답했습니다. 고칠 점을 바로 짚어 주는 방식이 맞습니다. ${choice}${confirm}`.trim();
    case "강하게 하되 다독임을 같이":
      return `세게 지적받은 뒤 더 열심히 한 경험이 있지만, 크게 혼나면 그 과목을 피한 적도 있습니다. 바로 짚되 잘한 점을 먼저 말하는 방식이 맞습니다. ${choice}${confirm}`.trim();
    case "차분히 다독이며":
      return `크게 혼나면 그 과목이 싫어지고 기분이 오래 남는다고 답했습니다. 잘한 점을 먼저 말한 뒤 차분히 고쳐 주는 방식이 맞습니다. ${choice}${confirm}`.trim();
    default:
      return `응답이 부족해 판정을 미룹니다. 첫 수업에서 세게 짚었을 때의 반응을 직접 확인합니다. ${choice}`.trim();
  }
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
    .map((e) => ({ key: e.key, label: CONSTRUCT_LABEL[e.key], score: e.score }));
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

/** 강점·약점 후보로 쓰는 축(지도 방식 반응은 우열이 아니라 제외). */
const BEHAVIOR_KEYS: Array<keyof CommonScores> = [
  "learningAttitude",
  "homeworkReliability",
  "goalClarity",
  "shortTermRecovery",
  "managementAcceptance",
  "questionInitiative",
  "phoneBoundary",
  "peerFocusBoundary",
];

/**
 * 결정론적 점수로 규칙 기반 최소 해석을 만든다.
 * 반환 shape는 AiInterpretation과 동일해 AI 성공 경로와 렌더러를 공유한다.
 */
export function buildFallbackInterpretation(
  profile: ScoreProfile
): AiInterpretation {
  const c = profile.common;
  const ranked = rankConstructs(c, BEHAVIOR_KEYS).sort((a, b) => b.score - a.score);
  const strengths = ranked
    .filter((e) => e.score >= GRADE_THRESHOLD.good)
    .slice(0, 3)
    .map((e) => `${e.label}: ${interpretBand(e.score)} (${averageNotation(e.key, e.score)})`);
  const growthAreas = [...ranked]
    .reverse()
    .filter((e) => e.score < GRADE_THRESHOLD.watch)
    .slice(0, 3)
    .map((e) => `${e.label}: ${interpretBand(e.score)} (${averageNotation(e.key, e.score)})`);

  const note = neutralQualityNote(profile);
  const noteSuffix = note ? ` (${note})` : "";
  const management = profile.verdicts?.management;
  const guidance = profile.verdicts?.guidance;

  const strongest = ranked[0];
  const supportFirst = ranked.length ? ranked[ranked.length - 1] : null;
  const behaviorSummary = strongest && supportFirst
    ? `${strongest.label} 응답은 잘 되고 있고, ${supportFirst.label}은 먼저 도울 부분입니다.`
    : "응답만으로 분명한 순서를 정하기 어려워 입학 상담에서 함께 확인합니다.";

  // 총평은 숫자를 쓰지 않는다. AI 출력이 거부되면 이 fallback이 그대로 학부모 화면에 나간다.
  const detailedSummary = [
    "학생이 직접 쓴 응답으로 현재 공부 습관을 정리했습니다.",
    behaviorSummary,
    strengths.length
      ? `잘 되고 있는 부분은 ${strengths.map((s) => s.split(":")[0]).join(", ")}입니다.`
      : "뚜렷한 강점을 아직 꼽기 어려워 입학 상담에서 구체적인 공부 경험을 더 확인합니다.",
    growthAreas.length
      ? `먼저 도울 부분은 ${growthAreas.map((s) => s.split(":")[0]).join(", ")}입니다.`
      : "",
    managementVerdictSentence(management),
    guidanceVerdictSentence(guidance),
    "학업 수준과 과목별 시작점은 별도의 입학테스트 결과를 함께 봅니다." + noteSuffix,
  ]
    .filter(Boolean)
    .join("\n\n");

  const recommendedCoaching =
    guidance?.verdict === "강하게 밀어도 됨"
      ? "고칠 점을 바로 짚어 주고, 첫 달은 정해진 틀로 시작합니다."
      : guidance?.verdict === "차분히 다독이며"
        ? "잘한 점을 먼저 말한 뒤 고칠 점을 하나씩 짚고, 첫 달은 확인 횟수를 조절합니다."
        : "바로 짚되 잘한 점을 먼저 말하고, 첫 달은 정해진 틀로 시작한 뒤 선택권을 넓힙니다.";

  return {
    studentType: behaviorSummary,
    detailedSummary,
    coreObservation: `${managementVerdictSentence(management)} ${guidanceVerdictSentence(guidance)}`,
    operatingCause:
      "점수만으로 이유를 단정하긴 어렵습니다. 입학테스트 풀이와 상담 내용을 함께 보며 원인을 확인합니다.",
    recommendedCoaching,
    verificationPlan14Days: buildVerificationPlan(profile),
    teacherBrief: [
      behaviorSummary,
      `관리: ${management?.verdict ?? "판정 보류"} / 지도 방식: ${guidance?.verdict ?? "판정 보류"}`,
      "설명 뒤 학생이 자기 말이나 한 문제 풀이로 이해를 보여 주게 해 주세요.",
      ...(note ? ["응답이 한쪽으로 치우쳐, 상담에서 문항 뜻과 실제 경험을 다시 확인해 주세요."] : []),
    ],
    strengths: strengths.length ? strengths : ["입학 상담에서 구체적인 공부 경험을 더 확인합니다"],
    growthAreas: growthAreas.length
      ? growthAreas
      : ["입학 상담에서 가장 먼저 도움받고 싶은 부분을 확인합니다"],
    crossEvidence: buildCrossEvidence(profile),
    nkFitInterpretation:
      "등록 적합도를 확정하는 결과가 아닙니다. 학생의 일정, 이전 학원 경험, 질문 방식과 과제 관리 요구를 입학 상담에서 확인해 초기 수업 조건을 제안합니다.",
    mathStrategy: buildSubjectStrategy(profile, "math"),
    englishStrategy: buildSubjectStrategy(profile, "english"),
    roadmap12Weeks: [
      {
        weeks: "1~4주",
        focus: "결과가 늦게 나오는 구간을 먼저 잡습니다.",
        actions: [
          "점수가 나온 뒤 이틀 안에 할 일을 잘게 쪼개 전달합니다.",
          "수업 중 담당 강사가 먼저 막힌 곳을 묻습니다.",
        ],
      },
      {
        weeks: "5~8주",
        focus: "오답을 무엇부터 볼지 순서를 고정합니다.",
        actions: [
          "오답 처리 순서를 정해 매주 같은 순서로 씁니다.",
          "고친 문제를 다시 확인하는 단계를 숙제 마무리에 넣습니다.",
        ],
      },
      {
        weeks: "9~12주",
        focus: "계획을 학생이 세우고 한 주 단위로만 점검합니다.",
        actions: [
          "학생이 스스로 주간 계획을 세웁니다.",
          "작은 변화 지표를 학부모와 공유합니다.",
        ],
      },
    ],
    parentSummary:
      "{{학생}}이 입학테스트 전에 직접 쓴 응답으로 현재의 공부 습관을 정리했습니다. 학업 수준은 과목 입학테스트와 함께 보고, 낮은 응답은 입학 상담에서 먼저 물어볼 부분으로 봐 주세요.",
    cautions: note
      ? ["응답에 추가 확인 신호가 있어, 입학 상담에서 문항 뜻과 실제 경험을 다시 확인해야 합니다."]
      : [],
  };
}

function buildVerificationPlan(profile: ScoreProfile): string[] {
  const plan = [
    "최근에 스스로 세운 공부 계획이 있었는지, 있었다면 어느 시점에서 멈췄는지 확인합니다.",
    "시험 점수가 낮게 나온 뒤 다음 날 무엇을 했는지 확인합니다.",
  ];
  if (isNum(profile.common.phoneBoundary) && profile.common.phoneBoundary < GRADE_THRESHOLD.watch) {
    plan.push("공부할 때 휴대폰을 어디에 두는지 학생·보호자에게 확인합니다.");
  }
  if (profile.verdicts?.guidance.confirmInCounseling) {
    plan.push("고칠 점을 바로 들었을 때와 돌려 들었을 때 어느 쪽이 편했는지 실제 사례로 확인합니다.");
  }
  if (profile.verdicts?.management.basisNote) {
    plan.push("학원을 다닌 경험이 없어, 숙제를 안 했을 때 남아서 한 적이 있는지 상담에서 묻습니다.");
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
    return "수학 응답은 조건 정리, 풀이 기록, 오답 분류 습관을 함께 본 자기보고입니다. 과목 입학테스트에서 낯선 문제를 시작하는 방식과 오답의 원인을 함께 확인합니다.";
  }
  if (!profile.english) return null;
  return "영어 응답은 어휘·문법·독해 공부 습관을 함께 본 자기보고입니다. 과목 입학테스트에서 긴 지문을 시작하는 방식과 틀린 답의 근거를 함께 확인합니다.";
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
  /**
   * 상담 전 학부모 질문지 답(표시용 스냅샷, 연락처 없음). 분석할 때 답이 있을 때만 존재한다.
   * 모양은 parent-safe.ts buildParentAnswersSafe 가 다시 검증한다(저장 jsonb 라 unknown 으로 둔다).
   */
  parentAnswers?: unknown;
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
