import { createClient } from "@/lib/supabase/server";
import { getCurrentTeacher } from "@/lib/actions/settings";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 인증: 로그인 세션 필수 (쿠키 기반 관리자 세션)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentTeacher = await getCurrentTeacher();
    if (!currentTeacher) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { registrationId, status } = await req.json();

    if (typeof registrationId !== "string") {
      return NextResponse.json({ error: "Missing registrationId" }, { status: 400 });
    }

    // 입력 검증: status는 순수 객체여야 하고, 고정 항목은 boolean 값,
    // 커스텀 항목(_custom)은 { id, label, done } 형태의 배열만 허용한다.
    const isCustomItem = (item: unknown): boolean =>
      item !== null &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      typeof (item as { id?: unknown }).id === "string" &&
      typeof (item as { label?: unknown }).label === "string" &&
      (item as { label: string }).label.length <= 200 &&
      typeof (item as { done?: unknown }).done === "boolean";
    const isValidStatus =
      status !== null &&
      typeof status === "object" &&
      !Array.isArray(status) &&
      Object.entries(status).every(([key, v]) =>
        key === "_custom"
          ? Array.isArray(v) && v.every(isCustomItem)
          : typeof v === "boolean"
      );
    if (!isValidStatus) {
      return NextResponse.json({ error: "Invalid status payload" }, { status: 400 });
    }

    const { error } = await supabase
      .from("registrations")
      .update({ onboarding_status: status })
      .eq("id", registrationId);

    if (error) {
      // If column doesn't exist, try to handle gracefully
      console.error("[Onboarding] Status update failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
