// 검증 전용(비프로덕션) V2 결과 보고서 프리뷰 라우트.
// 운영 DB에 V2 컬럼이 아직 없어 실제 제출→분석 경로로는 결과지를 열 수 없으므로,
// 가상 점수 프로필 + 규칙 기반(fallback) 해석으로 V2 보고서를 그대로 렌더해
// Playwright E2E·PDF 시각검증에 사용한다.
//
// 안전장치:
//   - production 빌드에서는 notFound()로 404 처리(공개 노출 금지).
//   - 가상의 학생/연락처만 사용한다(실학생 레코드 미참조).
//   - 실제 계산·렌더 경로(computeScoreProfile → buildFallbackInterpretation →
//     AnalysisReportV2Client)를 그대로 사용하므로 화면/PDF 검증 대상과 동일하다.

import { notFound } from "next/navigation";
import { computeScoreProfile } from "@/lib/assessment/v2/scoring";
import { ALL_ITEMS, REVERSE_IDS, isLikert } from "@/lib/assessment/v2/definition";
import {
  buildFallbackInterpretation,
  buildResultProfileV2,
} from "@/lib/assessment/v2/interpretation";
import type {
  ResponseMap,
  ScenarioResponseMap,
} from "@/lib/assessment/v2/types";
import { AnalysisReportV2Client } from "@/components/analysis-report-v2/analysis-report-v2-client";
import type { CounselorBackground } from "@/components/analysis-report-v2/counselor-report";

export const dynamic = "force-dynamic";

/** 모든 Likert 문항에 변동 있는 가상 응답을 채운다(straight_line·insufficient 방지). */
function buildFixtureResponses(): ResponseMap {
  const responses: ResponseMap = {};
  const cycle = [4, 5, 4, 3, 5];
  let i = 0;
  for (const item of ALL_ITEMS) {
    if (!isLikert(item)) continue;
    // 역채점 문항은 낮은 원응답 → 정방향 환산 시 높은 점수(좋은 프로필).
    responses[item.id] = REVERSE_IDS.has(item.id) ? 2 : cycle[i % cycle.length];
    i += 1;
  }
  return responses;
}

const SCENARIO_RESPONSES: ScenarioResponseMap = {
  C1: 3, // 휴대폰 치우고 오답 원인부터 (C)
  C2: 2, // 1:1 확인 (B)
  MS1: 4, // 다른 접근 재표현 (D)
  MS2: 3, // 실수 분류 후 간격 재풀이 (C)
  ES1: 4, // 전체 흐름 후 핵심 확인 (D)
  ES2: 3, // 간격 인출 (C)
};

const BACKGROUND: CounselorBackground = {
  prevAcademy: "가상 이전 학원",
  prevLeaveReason: "성적 정체로 학습 방식 변경을 원함",
  prevComplaint: "개인별 오답 관리가 부족했음",
  referral: "인터넷 검색",
  nkKnowledge: "숙제 관리가 철저하다고 알고 있음",
  nkExpectations: ["철저한 숙제 관리", "1:1 질문·개별 피드백", "클리닉·보완학습"],
  preferredDays: "월수금",
  availableTime: "평일 저녁 6시 이후",
  clinicCondition: "정규수업 뒤 정기 참여 가능",
  hasFuturePlan: "뚜렷한 목표 있음",
  dream: "소프트웨어 개발자",
  targetUniversity: "공과대학 컴퓨터공학",
  studyCore: "꾸준한 복습과 오답 정리",
  problemSelf: "집중이 오래 유지되지 않음",
  mathDifficulty: "함수와 도형 단원",
  englishDifficulty: "장문 독해와 어휘",
  healthNote: "특이사항 없음",
  requests: "체계적인 진도 관리와 즉시 피드백을 원함",
};

export default function DevReportPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const responses = buildFixtureResponses();
  const scoreProfile = computeScoreProfile({
    subjectSelection: "both",
    responses,
    scenarioResponses: SCENARIO_RESPONSES,
    mbti: { type: "ENFP", confidence: "high" },
    clinicAvailability: 100,
    priorityFeatures: ["clinic", "homework"],
    meta: { activeSeconds: 600, firstSelectDelays: [] },
  });

  const interpretation = buildFallbackInterpretation(scoreProfile);
  const profile = buildResultProfileV2({
    scoreProfile,
    interpretation,
    source: "fallback",
    generatedAt: "2026-07-11T00:00:00.000Z",
  });

  return (
    <AnalysisReportV2Client
      profile={profile}
      header={{
        name: "가상학생",
        schoolGrade: "안산중 · 중2",
        createdAt: "2026-07-11T00:00:00.000Z",
      }}
      background={BACKGROUND}
      contacts={{ studentPhone: "010-1234-5678", parentPhone: "010-8765-4321" }}
    />
  );
}
