import { getAnalysis } from "@/lib/actions/analysis";
import { getClasses, getTeachers } from "@/lib/actions/settings";
import { AnalysisDetailClient } from "@/components/analyses/analysis-detail-client";
import { AnalysisDetailV2Client } from "@/components/analyses/analysis-detail-v2-client";
import type { CounselorBackground } from "@/components/analysis-report-v2/counselor-report";
import { ClassRecommendationSection } from "@/components/analyses/class-recommendation-client";
import { notFound } from "next/navigation";
import { checkPagePermission } from "@/lib/check-permission";
import { createClient } from "@/lib/supabase/server";
import type { ResultStatus } from "@/types";
import {
  getConsultationByLink,
  getConsultationByName,
} from "@/lib/actions/consultation";

function toBackground(intake: Record<string, unknown> | null): CounselorBackground | null {
  if (!intake) return null;
  const s = (k: string) => {
    const v = intake[k];
    return typeof v === "string" && v.trim() ? v : null;
  };
  const exp = intake.nk_expectations;
  return {
    prevAcademy: s("prev_academy"),
    prevLeaveReason: s("prev_leave_reason"),
    prevComplaint: s("prev_complaint"),
    referral: s("referral"),
    nkKnowledge: s("nk_knowledge"),
    nkExpectations: Array.isArray(exp) ? (exp as string[]) : null,
    preferredDays: s("preferred_days"),
    availableTime: s("available_time"),
    clinicCondition: s("clinic_condition"),
    hasFuturePlan: s("has_future_plan"),
    dream: s("dream"),
    targetUniversity: s("target_university"),
    studyCore: s("study_core"),
    problemSelf: s("problem_self"),
    mathDifficulty: s("math_difficulty"),
    englishDifficulty: s("english_difficulty"),
    healthNote: s("health_note"),
    requests: s("requests"),
  };
}

export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await checkPagePermission("/analyses");
  const { id } = await params;
  const [analysis, classes, teachers] = await Promise.all([
    getAnalysis(id),
    getClasses(),
    getTeachers(),
  ]);

  if (!analysis) {
    notFound();
  }

  const supabase = await createClient();

  // 상담을 식별하는 데 필요한 연락처와 V2 사전정보를 먼저 조회한다.
  let studentPhone: string | null = null;
  let parentPhone: string | null = null;
  let intakeV2: Record<string, unknown> | null = null;
  let responsesV2: Record<string, unknown> | null = null;
  if (analysis.survey_id) {
    const { data: survey } = await supabase
      .from("surveys")
      .select("student_phone, parent_phone, intake_v2, responses_v2")
      .eq("id", analysis.survey_id)
      .single();
    if (survey) {
      studentPhone = survey.student_phone;
      parentPhone = survey.parent_phone;
      intakeV2 = (survey.intake_v2 as Record<string, unknown> | null) ?? null;
      responsesV2 = (survey.responses_v2 as Record<string, unknown> | null) ?? null;
    }
  }

  // 분석 ID → 학부모 연락처 순으로 찾고, 둘 다 불일치하면 동명이인의 상담으로 후퇴하지 않는다.
  let consultationResultStatus: ResultStatus | null = null;
  let consultationData: Record<string, string | null> | null = null;
  const linkedConsultation = await getConsultationByLink({ analysisId: analysis.id });
  const consultation =
    linkedConsultation ??
    (await getConsultationByName(analysis.name, {
      analysisId: analysis.id,
      parentPhone,
    }));

  if (consultation) {
    consultationResultStatus = consultation.result_status as ResultStatus;
    consultationData = consultation as unknown as Record<string, string | null>;
  }

  // 등록 안내문 존재 여부
  const { data: existingReg } = await supabase
    .from("registrations")
    .select("id")
    .eq("analysis_id", id)
    .limit(1)
    .maybeSingle();

  // 설문 V2(학습 프로필) 분석이면 전용 V2 결과지를 렌더한다(V1 분석은 기존 화면 그대로).
  if (analysis.analysis_version === "v2" && analysis.result_profile_v2) {
    return (
      <div className="space-y-6">
        <AnalysisDetailV2Client
          analysis={analysis}
          profile={analysis.result_profile_v2}
          classes={classes}
          teachers={teachers}
          background={toBackground(intakeV2)}
          responses={responsesV2}
          contacts={{ studentPhone, parentPhone }}
          consultationData={consultationData}
          existingRegistrationId={existingReg?.id || null}
          consultationId={linkedConsultation?.id ?? null}
        />
        <ClassRecommendationSection
          analysisId={analysis.id}
          studentName={analysis.name}
          studentGrade={analysis.grade}
          initialTestScore={consultationData?.test_score ?? null}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnalysisDetailClient
        analysis={analysis}
        classes={classes}
        teachers={teachers}
        consultationResultStatus={consultationResultStatus}
        consultationData={consultationData}
        existingRegistrationId={existingReg?.id || null}
        studentPhone={studentPhone}
        parentPhone={parentPhone}
        consultationId={linkedConsultation?.id ?? null}
      />
      <ClassRecommendationSection
        analysisId={analysis.id}
        studentName={analysis.name}
        studentGrade={analysis.grade}
        initialTestScore={consultationData?.test_score ?? null}
      />
    </div>
  );
}
