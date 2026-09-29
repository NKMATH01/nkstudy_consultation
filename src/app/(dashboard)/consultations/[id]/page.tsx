import { notFound } from "next/navigation";
import {
  getConsultation,
  getConsultationEvents,
} from "@/lib/actions/consultation";
import { ConsultationDetailClient } from "@/components/consultations/consultation-detail-client";
import { checkPagePermission } from "@/lib/check-permission";
import { createClient } from "@/lib/supabase/server";
import { authorizeConsultation } from "@/lib/recording/guard";
import { canMutateRecordings } from "@/lib/recording/access";
import { listRecordingViews } from "@/lib/recording/queries";
import type { RecordingPanelProps } from "@/components/consultations/recording-panel";

/** 상담 녹음 패널 데이터(D1). 열람 권한이 없거나 조회에 실패하면 null → 패널을 그리지 않는다. */
async function loadRecordingPanel(consultationId: string): Promise<RecordingPanelProps | null> {
  const auth = await authorizeConsultation(consultationId, "view");
  if (!auth.ok) return null;
  try {
    const recordings = await listRecordingViews(auth.admin, consultationId);
    return {
      consultationId,
      canRecord: canMutateRecordings(auth.staff.role),
      userKey: auth.staff.label,
      initialRecordings: recordings,
    };
  } catch (e) {
    console.error("[recording] 상담 상세 녹음 목록 조회 실패", {
      consultationId,
      error: e instanceof Error ? e.message : "unknown",
    });
    return null;
  }
}

export default async function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await checkPagePermission("/consultations");
  const { id } = await params;
  const consultation = await getConsultation(id);

  if (!consultation) {
    notFound();
  }

  const supabase = await createClient();
  const [bookingResult, analysisResult, surveyResult, registrationResult, studentResult, events, recordingPanel] =
    await Promise.all([
      consultation.booking_id
        ? supabase
            .from("bookings")
            .select("id, booking_date, booking_hour, status, rescheduled_at")
            .eq("id", consultation.booking_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      consultation.analysis_id
        ? supabase
            .from("analyses")
            .select("id, name, student_type, created_at")
            .eq("id", consultation.analysis_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      consultation.analysis_id
        ? supabase
            .from("surveys")
            .select("id, created_at")
            .eq("analysis_id", consultation.analysis_id)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      consultation.registration_id
        ? supabase
            .from("registrations")
            .select("id, registration_date, created_at")
            .eq("id", consultation.registration_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      consultation.student_id
        ? supabase
            .from("students")
            .select("id, name, is_active")
            .eq("id", consultation.student_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      getConsultationEvents(consultation.id),
      loadRecordingPanel(consultation.id),
    ]);

  return (
    <ConsultationDetailClient
      consultation={consultation}
      journey={{
        booking: bookingResult.data,
        analysis: analysisResult.data,
        survey: surveyResult.data,
        registration: registrationResult.data,
        student: studentResult.data,
        events,
      }}
      recordingPanel={recordingPanel}
    />
  );
}
