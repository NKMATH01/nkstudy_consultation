import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const email = "01047242316@nk.local";
const password = "nk1004"; // toAuthPassword("1004")

async function main() {
  // 기존 계정 확인
  const { data: users } = await supabase.auth.admin.listUsers();
  const existing = users?.users?.find((u) => u.email === email);

  if (existing) {
    console.log("기존 Auth 계정 발견:", existing.id);
    // 비밀번호 업데이트
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
    });
    if (error) {
      console.error("비밀번호 업데이트 실패:", error.message);
    } else {
      console.log("비밀번호 nk1004로 업데이트 완료");
    }

    // teachers 테이블에 auth_user_id 연결
    const { error: linkErr } = await supabase
      .from("teachers")
      .update({ auth_user_id: existing.id })
      .or("phone.eq.01047242316,phone.eq.010-4724-2316");
    if (linkErr) console.error("auth_user_id 연결 실패:", linkErr.message);
    else console.log("teachers 테이블 auth_user_id 연결 완료");
  } else {
    console.log("새 Auth 계정 생성 중...");
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      console.error("계정 생성 실패:", error.message);
    } else {
      console.log("계정 생성 완료:", data.user.id);
      // teachers 테이블에 auth_user_id 연결
      const { error: linkErr } = await supabase
        .from("teachers")
        .update({ auth_user_id: data.user.id })
        .or("phone.eq.01047242316,phone.eq.010-4724-2316");
      if (linkErr) console.error("auth_user_id 연결 실패:", linkErr.message);
      else console.log("teachers 테이블 auth_user_id 연결 완료");
    }
  }
}

main().catch(console.error);
