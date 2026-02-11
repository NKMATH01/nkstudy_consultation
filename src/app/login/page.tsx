"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const doLogin = async (em: string, pw: string) => {
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: em,
      password: pw,
    });

    if (err) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await doLogin(email, password);
  };

  // 보안: 테스트 계정 정보를 환경변수에서 가져와 프로덕션 노출 방지
  const handleQuickLogin = () => {
    doLogin(
      process.env.NEXT_PUBLIC_TEST_EMAIL || "",
      process.env.NEXT_PUBLIC_TEST_PASSWORD || ""
    );
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#0A0F1E" }}>
      {/* Left - Branding */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        <div
          className="absolute w-full h-full"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, rgba(37,99,235,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(212,168,83,0.06) 0%, transparent 50%)",
          }}
        />
        <div className="relative text-center max-w-[360px]">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-extrabold text-white"
            style={{
              background: "linear-gradient(135deg, #D4A853, #B8892E)",
              boxShadow: "0 8px 32px rgba(212,168,83,0.3)",
              letterSpacing: "-0.03em",
            }}
          >
            NK
          </div>
          <h1
            className="text-[26px] font-extrabold text-white mb-2.5"
            style={{ letterSpacing: "-0.03em" }}
          >
            NK Academy
          </h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
            학원 상담 관리 시스템
          </p>
        </div>
      </div>

      {/* Right - Login Form */}
      <div
        className="w-[440px] flex flex-col justify-center px-11 py-12 bg-white"
        style={{ borderRadius: "24px 0 0 24px" }}
      >
        <h2
          className="text-[22px] font-bold mb-1"
          style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
        >
          로그인
        </h2>
        <p className="text-[13px] mb-8" style={{ color: "#64748B" }}>
          계정 정보를 입력하세요
        </p>

        <form onSubmit={handleLogin} className="space-y-3.5">
          <div>
            <label
              className="block mb-1.5 text-xs font-semibold"
              style={{ color: "#64748B", letterSpacing: "0.03em" }}
            >
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@nk.com"
              required
              className="w-full px-3.5 py-2.5 rounded-[7px] text-[13.5px] outline-none transition-all"
              style={{
                border: "1.5px solid #E2E8F0",
                color: "#1E293B",
                background: "#FFFFFF",
              }}
            />
          </div>
          <div>
            <label
              className="block mb-1.5 text-xs font-semibold"
              style={{ color: "#64748B", letterSpacing: "0.03em" }}
            >
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              required
              className="w-full px-3.5 py-2.5 rounded-[7px] text-[13.5px] outline-none transition-all"
              style={{
                border: "1.5px solid #E2E8F0",
                color: "#1E293B",
                background: "#FFFFFF",
              }}
            />
          </div>

          {error && (
            <div
              className="text-xs font-medium px-3 py-2 rounded-lg"
              style={{ background: "#FFF1F2", color: "#E11D48" }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-[10px] text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1.5"
            style={{
              background: "linear-gradient(135deg, #D4A853, #C49B3D)",
              boxShadow: "0 2px 8px rgba(212,168,83,0.3)",
            }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "로그인 중..." : "로그인"}
          </button>

          {/* 보안: 개발 환경에서만 테스트 로그인 버튼 노출 */}
          {process.env.NODE_ENV === "development" && (
            <div className="text-center mt-4">
              <button
                type="button"
                disabled={loading}
                onClick={handleQuickLogin}
                className="py-2.5 px-5 rounded-[10px] text-[12.5px] font-medium transition-all disabled:opacity-50"
                style={{
                  background: "none",
                  border: "1.5px solid #E2E8F0",
                  color: "#475569",
                }}
              >
                테스트 계정으로 로그인
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
