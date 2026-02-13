import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import { phoneToEmail } from "@/lib/auth";
import { env } from "@/lib/env";

/** 일회성 셋업: teachers 테이블의 모든 선생님에 대해 Supabase Auth 계정 생성 */
export async function POST() {
  try {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다" },
        { status: 500 }
      );
    }

    const admin = createAdminClient();

    // auth_user_id가 없는 선생님들 조회
    const { data: teachers, error: fetchErr } = await admin
      .from("teachers")
      .select("id, name, phone, password, role")
      .is("auth_user_id", null);

    if (fetchErr) {
      // auth_user_id 컬럼이 없는 경우 전체 조회
      const { data: allTeachers, error: fetchErr2 } = await admin
        .from("teachers")
        .select("id, name, phone, password, role");

      if (fetchErr2) {
        return NextResponse.json({ error: fetchErr2.message }, { status: 500 });
      }

      const results = [];
      for (const t of allTeachers ?? []) {
        if (!t.phone) continue;
        const digits = String(t.phone).replace(/\D/g, "");
        const email = phoneToEmail(digits);
        const pw = t.password || "1234";

        const { data: authData, error: authErr } = await admin.auth.admin.createUser({
          email,
          password: pw,
          email_confirm: true,
        });

        if (authErr) {
          results.push({ name: t.name, phone: t.phone, status: "error", message: authErr.message });
        } else {
          // auth_user_id 업데이트 시도
          try {
            await admin.from("teachers").update({ auth_user_id: authData.user.id }).eq("id", t.id);
          } catch { /* 컬럼 없으면 무시 */ }
          results.push({ name: t.name, phone: t.phone, status: "created", authId: authData.user.id });
        }
      }

      return NextResponse.json({ success: true, results });
    }

    const results = [];
    for (const t of teachers ?? []) {
      if (!t.phone) continue;
      const digits = String(t.phone).replace(/\D/g, "");
      const email = phoneToEmail(digits);
      const pw = t.password || "1234";

      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email,
        password: pw,
        email_confirm: true,
      });

      if (authErr) {
        results.push({ name: t.name, phone: t.phone, status: "error", message: authErr.message });
      } else {
        await admin.from("teachers").update({ auth_user_id: authData.user.id }).eq("id", t.id);
        results.push({ name: t.name, phone: t.phone, status: "created", authId: authData.user.id });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "셋업 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
