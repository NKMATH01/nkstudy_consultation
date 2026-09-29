// D7: 상담 삭제 직전 녹음 정리. 녹음 원본 삭제 확인 → 녹음 행 삭제. 실패하면 상담 삭제를 중단시킨다.
// 녹음이 없으면 아무것도 하지 않는다(기존 삭제 흐름 그대로).

import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { canMutateRecordings } from "@/lib/recording/access";
import { resolveStaff } from "@/lib/recording/staff";
import { deleteRecordingsForConsultation } from "@/lib/recording/purge";

/** 마이그레이션 적용 전(표 없음)으로 볼 오류 코드. */
const TABLE_MISSING_CODES = new Set(["42P01", "PGRST205"]);

export async function prepareConsultationDelete(
  consultationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // 서비스 롤 키가 없으면 녹음 표를 볼 수 없다. 녹음이 있다면 FK(ON DELETE RESTRICT)가 상담 삭제를 막는다.
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return { ok: true };
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("consultation_recordings")
    .select("id", { count: "exact", head: true })
    .eq("consultation_id", consultationId);
  if (error) {
    if (error.code && TABLE_MISSING_CODES.has(error.code)) return { ok: true };
    console.error("[recording] 상담 삭제 전 녹음 확인 실패", { consultationId, error: error.message });
    return { ok: false, error: "상담 녹음 확인에 실패해 삭제를 중단했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
  if (!count) return { ok: true };

  const staff = await resolveStaff();
  if (!canMutateRecordings(staff?.role)) {
    return { ok: false, error: "녹음이 있는 상담은 원장·관리자만 삭제할 수 있습니다." };
  }
  const result = await deleteRecordingsForConsultation(admin, consultationId);
  if (!result.ok) {
    console.error("[recording] 상담 삭제 전 녹음 정리 실패", { consultationId });
    return { ok: false, error: `${result.error} 상담은 삭제하지 않았습니다.` };
  }
  return { ok: true };
}
