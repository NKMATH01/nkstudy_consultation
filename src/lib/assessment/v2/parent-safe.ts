// 학부모 공유용 parent-safe snapshot (§12.3).
// deny-by-default allowlist: 이 모듈은 result_profile_v2에서 명시적으로 허용된 값만
// 골라 별도 객체를 "새로 조립"한다(spread/얕은 복사 금지). 따라서 아래 금지 항목은
// payload 자체에서 물리적으로 제외된다(CSS 숨김 방식 아님, §12.3).
//
// 제외(절대 포함 금지):
//   - 연락처(학생/학부모 전화번호), DB id, report token
//   - 내부 확인질문·교사 brief(teacherBrief)·근거 코드(crossEvidence)·운영 메모(cautions)
//   - 상황문항 raw evidence 코드·태그(situations)
//   - 상담자용 원인/권장 지도(coreObservation, operatingCause,
//     recommendedCoaching, verificationPlan14Days)
//   ※ detailedSummary(상세 총평)는 학부모용으로 허용한다: "쉬운 한국어" 프롬프트로 생성되어
//     전 영역(태도·숙제·휴대폰·의지·회복·친구·과목·NK 적합)을 아우르므로 01 종합 분석 본문에 쓴다.
//   - 응답 품질 상세 사유(reasons) — status만 중립 문구로 전달
//
// 이 함수는 순수 함수다. 클라이언트(상담자 화면의 학부모 미리보기 토글)와
// 서버(공유 token snapshot 생성)가 동일 함수를 호출하므로 두 화면이 항상 일치한다.

import type { ResultProfileV2 } from "./interpretation";
import { applyStudentNameToInterpretation } from "./name-substitution";
import { ALL_ITEMS, isLikert } from "./definition";
import { SCALE_LABELS_V2 } from "./display";
import type {
  CommonScores,
  EnglishScores,
  MathScores,
  MbtiAxes,
  NkFitStage,
  Score,
  SubjectSelection,
} from "./types";

/** 학부모 공유용 점수 subset. PII·근거 코드·상황 태그를 포함하지 않는다. */
export interface ParentSafeScores {
  common: CommonScores;
  coaching: {
    coachingType: string;
    autonomyStructureType: string;
    challenge: Score;
    safety: Score;
    autonomy: Score;
    structure: Score;
  };
  math: MathScores | null;
  english: EnglishScores | null;
  /** MBTI는 학생 본인 자기보고이므로 학부모 공유 허용(원점수/조정/최종 표시, §8.5). */
  mbtiAxes: MbtiAxes;
  nkFit: {
    stage: NkFitStage;
    overall: number | null;
    areas: {
      clinic: NkAreaSafe;
      weeklyTest: NkAreaSafe;
      homework: NkAreaSafe;
      immediateFeedback: NkAreaSafe;
    };
  };
  /** 상세 사유(reasons)는 제외하고 상태만 전달. review면 UI가 중립 문구로 표시. */
  responseQualityStatus: "normal" | "review";
}

interface NkAreaSafe {
  preference: number | null;
  readiness: number | null;
  featureFit: number | null;
}

/** 학부모 공유용 해석 subset. 상담자 전용 필드는 포함하지 않는다. */
export interface ParentSafeInterpretation {
  studentType: string;
  parentSummary: string;
  /** 전 영역 상세 총평(쉬운 한국어). 과거 공유 snapshot에는 없을 수 있어 optional로 둔다. */
  detailedSummary?: string;
  strengths: string[];
  growthAreas: string[];
  roadmap12Weeks: { weeks: string; focus: string; actions: string[] }[];
  nkFitInterpretation: string;
  mathStrategy: string | null;
  englishStrategy: string | null;
}

/**
 * "친구와 공부" 카드용 문항 응답.
 * 또래 관련 문항은 합산 점수로 묶으면 뜻이 흐려져(도움 받는 힘 + 집중 흔들림이 상쇄)
 * 문항 요지와 학생이 고른 보기만 그대로 보여 준다. **점수·밴드는 담지 않는다.**
 */
export interface PeerResponseSafe {
  /** 문항이 묻는 내용(정의 원문) */
  question: string;
  /** 학생이 고른 보기 문구(예: "대체로 맞다") */
  answerLabel: string;
}

export interface ParentSafeProfile {
  instrumentVersion: "v2";
  subjectSelection: SubjectSelection;
  generatedAt: string;
  /** 표시용 이름·학교급/학년(연락처 없음). 이름은 자녀 본인이므로 공유 허용. */
  display: { name: string; schoolGrade: string };
  scores: ParentSafeScores;
  interpretation: ParentSafeInterpretation;
  /**
   * 또래 문항 응답(F1·F2·F4). 응답 원본이 없으면 생략된다.
   * 기존에 발급된 공유 토큰에는 이 필드가 없으므로 화면은 없을 때도 동작해야 한다.
   */
  peerResponses?: PeerResponseSafe[];
}

/** "친구와 공부" 카드에 쓰는 또래 문항. F3(집중 경계)은 위험축이라 여기 넣지 않는다. */
const PEER_ITEM_IDS = ["F1", "F2", "F4"] as const;

/**
 * 또래 문항의 "문항 요지 + 고른 보기"만 뽑는다.
 * 숫자는 담지 않으므로 학부모 화면에서 점수로 오해될 여지가 없다.
 */
export function buildPeerResponses(
  responses: Record<string, unknown> | null | undefined,
): PeerResponseSafe[] {
  if (!responses) return [];

  const result: PeerResponseSafe[] = [];
  for (const id of PEER_ITEM_IDS) {
    const item = ALL_ITEMS.find((it) => it.id === id);
    if (!item || !isLikert(item)) continue;

    const value = responses[id];
    if (typeof value !== "number" || value < 1 || value > 5) continue;

    result.push({
      question: item.text,
      answerLabel: SCALE_LABELS_V2[item.scale][value - 1],
    });
  }
  return result;
}

function safeNkArea(area: {
  preference: number | null;
  readiness: number | null;
  featureFit: number | null;
}): NkAreaSafe {
  return {
    preference: area.preference,
    readiness: area.readiness,
    featureFit: area.featureFit,
  };
}

/**
 * result_profile_v2(상담자 원본) → 학부모 공유용 parent-safe snapshot.
 * allowlist된 값만 새 객체로 조립한다. 금지 항목은 여기서 아예 참조하지 않는다.
 */
export function buildParentSafeProfile(
  full: ResultProfileV2,
  display: { name: string; schoolGrade: string },
  /** 또래 문항 응답 원본(선택). 없으면 "친구와 공부" 카드가 생략된다. */
  responses?: Record<string, unknown> | null
): ParentSafeProfile {
  const s = full.scores;
  // 저장 경로(analysis-v2)에서 이미 치환됐더라도, 미저장·프리뷰 렌더까지 일관되게
  // 학생 호칭을 실제 이름으로 확정한다(멱등: 토큰·따님/아이가 없으면 그대로).
  const i = applyStudentNameToInterpretation(full.interpretation, display.name);
  const peerResponses = buildPeerResponses(responses);

  return {
    instrumentVersion: "v2",
    subjectSelection: full.subjectSelection,
    generatedAt: full.generatedAt,
    display: {
      name: display.name,
      schoolGrade: display.schoolGrade,
    },
    scores: {
      common: { ...s.common },
      coaching: {
        coachingType: s.coaching.coachingType,
        autonomyStructureType: s.coaching.autonomyStructureType,
        challenge: s.coaching.challenge,
        safety: s.coaching.safety,
        autonomy: s.coaching.autonomy,
        structure: s.coaching.structure,
      },
      math: s.math ? { ...s.math } : null,
      english: s.english ? { ...s.english } : null,
      mbtiAxes: {
        interactionAxis: { ...s.mbtiAxes.interactionAxis },
        conceptAxis: { ...s.mbtiAxes.conceptAxis },
        relationalFeedbackAxis: { ...s.mbtiAxes.relationalFeedbackAxis },
        flexibilityAxis: { ...s.mbtiAxes.flexibilityAxis },
        applied: s.mbtiAxes.applied,
        confidenceWeight: s.mbtiAxes.confidenceWeight,
      },
      nkFit: {
        stage: s.nkFit.stage,
        overall: s.nkFit.overall,
        areas: {
          clinic: safeNkArea(s.nkFit.areas.clinic),
          weeklyTest: safeNkArea(s.nkFit.areas.weeklyTest),
          homework: safeNkArea(s.nkFit.areas.homework),
          immediateFeedback: safeNkArea(s.nkFit.areas.immediateFeedback),
        },
      },
      responseQualityStatus: s.responseQuality.status,
    },
    interpretation: {
      studentType: i.studentType,
      parentSummary: i.parentSummary,
      detailedSummary: i.detailedSummary,
      strengths: [...i.strengths],
      growthAreas: [...i.growthAreas],
      roadmap12Weeks: i.roadmap12Weeks.map((r) => ({
        weeks: r.weeks,
        focus: r.focus,
        actions: [...r.actions],
      })),
      nkFitInterpretation: i.nkFitInterpretation,
      mathStrategy: i.mathStrategy,
      englishStrategy: i.englishStrategy,
    },
    ...(peerResponses.length > 0 ? { peerResponses } : {}),
  };
}

/** parent-safe payload에 절대 존재해서는 안 되는 키(테스트·런타임 감사용). */
export const PARENT_FORBIDDEN_KEYS = [
  "teacherBrief",
  "crossEvidence",
  "coreObservation",
  "operatingCause",
  "recommendedCoaching",
  "verificationPlan14Days",
  "cautions",
  "situations",
  "reasons",
  "priorityConcerns",
  "studentPhone",
  "parentPhone",
  "student_phone",
  "parent_phone",
  "phone",
  "id",
  "surveyId",
  "survey_id",
  "token",
  "report_html",
  "healthNote",
  "health_note",
] as const;

/**
 * 객체 트리에서 금지 키가 하나라도 있으면 그 경로를 반환한다(없으면 []).
 * 런타임 감사·단위 테스트 양쪽에서 사용한다.
 */
export function findForbiddenKeys(value: unknown, path = "$"): string[] {
  const hits: string[] = [];
  const forbidden = new Set<string>(PARENT_FORBIDDEN_KEYS);
  const walk = (v: unknown, p: string) => {
    if (Array.isArray(v)) {
      v.forEach((item, idx) => walk(item, `${p}[${idx}]`));
      return;
    }
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (forbidden.has(k)) hits.push(`${p}.${k}`);
        walk(val, `${p}.${k}`);
      }
    }
  };
  walk(value, path);
  return hits;
}
