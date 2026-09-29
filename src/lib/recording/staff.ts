// 녹음 모듈 전용 직원 판정(D1). getCurrentTeacher 는 id 를 돌려주지 않고 전화 중복도 허용하므로 쓰지 않는다.
// 규칙: 로그인 이메일 → (admin@nk.com = 시스템 admin) / nk.local 전화번호 → 활성 teachers 행이 정확히 1개일 때만.
// 중복·없음·오류는 null(거부).

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTeacherEmail } from "@/lib/auth";
import type { StaffIdentity } from "@/lib/recording/access";

export const SYSTEM_ADMIN_EMAIL = "admin@nk.com";

export interface ResolvedStaff extends StaffIdentity {
  /** DB 에 남길 표시(이름·전화번호 아님). */
  label: string;
}

export async function resolveStaff(): Promise<ResolvedStaff | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email;
    if (!email) return null;

    if (email === SYSTEM_ADMIN_EMAIL) {
      return { teacherId: null, role: "admin", label: "system:admin" };
    }
    if (!isTeacherEmail(email)) return null;

    const digits = email.split("@")[0].replace(/\D/g, "");
    if (digits.length < 10) return null;
    const formatted =
      digits.length === 11 ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}` : digits;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("teachers")
      .select("id, role, is_active")
      .or(`phone.eq.${digits},phone.eq.${formatted}`);
    if (error) {
      console.error("[recording] resolveStaff 조회 실패", { error: error.message });
      return null;
    }
    const active = ((data ?? []) as { id: string; role: string | null; is_active: boolean | null }[]).filter(
      (t) => t.is_active !== false,
    );
    if (active.length !== 1) return null; // 없음·전화 중복 → 거부
    const t = active[0];
    return { teacherId: t.id, role: t.role ?? null, label: `teacher:${t.id}` };
  } catch (e) {
    console.error("[recording] resolveStaff 예외", { error: e instanceof Error ? e.message : "unknown" });
    return null;
  }
}
