import { createClient } from "@/lib/supabase/server";
import {
  verifyProposal,
  executeMutation,
  type Proposal,
} from "@/lib/chat-tools";

async function getCallerRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  if (user.email === "admin@nk.com") {
    return { name: "관리자", role: "admin" };
  }

  if (user.email.endsWith("@nk.local")) {
    const digits = user.email.replace("@nk.local", "").replace(/\D/g, "");
    let formatted = digits;
    if (digits.length === 11) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    const { data } = await supabase
      .from("teachers")
      .select("name, role")
      .or(`phone.eq.${digits},phone.eq.${formatted}`)
      .limit(1)
      .single();
    return data ? { name: data.name, role: data.role } : null;
  }

  return null;
}

export async function POST(req: Request) {
  try {
    // 1. 인증/권한 확인
    const caller = await getCallerRole();
    if (!caller) {
      return Response.json({ success: false, message: "인증이 필요합니다." }, { status: 401 });
    }
    if (!["director", "principal", "admin"].includes(caller.role ?? "")) {
      return Response.json({ success: false, message: "권한이 없습니다." }, { status: 403 });
    }

    // 2. 제안 데이터 수신
    const { proposal } = (await req.json()) as { proposal: Proposal };
    if (!proposal) {
      return Response.json({ success: false, message: "제안 데이터가 없습니다." }, { status: 400 });
    }

    // 3. HMAC 서명 + TTL 검증
    const verification = verifyProposal(proposal);
    if (!verification.valid) {
      return Response.json({ success: false, message: verification.error }, { status: 400 });
    }

    // 4. 실행
    const result = await executeMutation(proposal);

    return Response.json(result, { status: result.success ? 200 : 500 });
  } catch (err) {
    console.error("[chat/execute] 오류:", err);
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    return Response.json({ success: false, message: msg }, { status: 500 });
  }
}
