import { getConsultations } from "@/lib/actions/consultation";
import { getClasses } from "@/lib/actions/settings";
import { ConsultationListClient } from "@/components/consultations/consultation-list-client";
import { checkPagePermission } from "@/lib/check-permission";
import { createClient } from "@/lib/supabase/server";
import { buildAlimtalkSendMap } from "@/lib/consultation-alimtalk";

export default async function ConsultationsPage() {
  await checkPagePermission("/consultations");
  const supabase = await createClient();
  const [result, classes, alimtalkResult] = await Promise.all([
    getConsultations({ limit: 100 }),
    getClasses(),
    supabase
      .from("nkc_scheduled_messages")
      .select("consultation_id, status, send_at")
      // 과거 발송 이력 조회이므로 발송용 상수와 분리해 v1/v2 코드를 명시한다.
      // 상수를 쓰면 v1로 발송된 기존 이력의 배지가 사라진다.
      .in("template_code", ["consult_confirm", "consult_confirm_v2"])
      .not("consultation_id", "is", null)
      .order("send_at", { ascending: false }),
  ]);

  if (alimtalkResult.error) {
    console.error(
      "[ConsultationsPage] 알림톡 발송 이력 조회 실패:",
      alimtalkResult.error.message,
    );
  }

  const alimtalkSendMap = buildAlimtalkSendMap(
    alimtalkResult.error ? [] : (alimtalkResult.data ?? []),
  );

  return (
    <ConsultationListClient
      initialData={result.data}
      initialPagination={result.pagination}
      classes={classes.map((c) => ({ id: c.id, name: c.name }))}
      alimtalkSendMap={alimtalkSendMap}
    />
  );
}
