"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { phoneToEmail, toAuthPassword } from "@/lib/auth";
import { getTeacherByPhone, changeTeacherPassword } from "@/lib/actions/settings";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState("");

  // 비밀번호 변경 모달 상태
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [teacherName, setTeacherName] = useState("");

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  };

  const doLogin = async (em: string, pw: string) => {
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: em,
      password: pw,
    });

    if (err) {
      setError("전화번호 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
      return;
    }

    setLoading(false);
    return true;
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("올바른 전화번호를 입력해주세요.");
      return;
    }

    const loginEmail = phoneToEmail(digits);
    const success = await doLogin(loginEmail, toAuthPassword(password));

    if (success) {
      // 선생님 정보 확인
      const teacher = await getTeacherByPhone(digits);

      // 클리닉 선생님은 로그인 불가
      if (teacher && teacher.role === "clinic") {
        const supabase = createClient();
        await supabase.auth.signOut();
        setError("클리닉 선생님은 이 프로그램에 로그인할 수 없습니다.");
        setLoading(false);
        return;
      }

      // 비밀번호 변경 필요 여부 확인
      if (teacher && !teacher.password_changed) {
        setTeacherName(teacher.name);
        setShowPasswordChange(true);
      } else {
        window.location.href = "/";
      }
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await doLogin(email, password);
    if (success) {
      window.location.href = "/";
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length !== 4 || !/^\d{4}$/.test(newPassword)) {
      setError("비밀번호는 4자리 숫자여야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (newPassword === "1234") {
      setError("1234 외의 비밀번호를 설정해주세요.");
      return;
    }

    setChangingPassword(true);
    setError("");

    const digits = phone.replace(/\D/g, "");
    const result = await changeTeacherPassword(digits, newPassword);

    if (result.success) {
      // Supabase Auth 비밀번호도 변경 (현재 로그인된 세션으로)
      const supabase = createClient();
      await supabase.auth.updateUser({ password: toAuthPassword(newPassword) });

      setShowPasswordChange(false);
      window.location.href = "/";
    } else {
      setError(result.error || "비밀번호 변경에 실패했습니다.");
    }
    setChangingPassword(false);
  };

  // 보안: 테스트 계정 정보를 환경변수에서 가져와 프로덕션 노출 방지
  const handleQuickLogin = () => {
    doLogin(
      process.env.NEXT_PUBLIC_TEST_EMAIL || "",
      process.env.NEXT_PUBLIC_TEST_PASSWORD || ""
    ).then((success) => {
      if (success) {
        window.location.href = "/";
      }
    });
  };

  // 비밀번호 변경 모달
  if (showPasswordChange) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0F1E" }}>
        <div className="w-[400px] bg-white rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 text-lg font-extrabold text-white"
              style={{ background: "linear-gradient(135deg, #D4A853, #B8892E)" }}
            >
              NK
            </div>
            <h2 className="text-lg font-bold text-slate-900">비밀번호 변경</h2>
            <p className="text-sm text-slate-500 mt-1">
              {teacherName} 선생님, 새로운 비밀번호를 설정해주세요
            </p>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-slate-500">
                새 비밀번호 (4자리 숫자)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="4자리 숫자"
                required
                className="w-full px-3.5 py-2.5 rounded-lg text-sm text-center tracking-[0.5em] font-bold outline-none"
                style={{ border: "1.5px solid #E2E8F0" }}
                autoFocus
              />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-slate-500">
                비밀번호 확인
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="다시 입력"
                required
                className="w-full px-3.5 py-2.5 rounded-lg text-sm text-center tracking-[0.5em] font-bold outline-none"
                style={{ border: "1.5px solid #E2E8F0" }}
              />
            </div>

            {error && (
              <div className="text-xs font-medium px-3 py-2 rounded-lg" style={{ background: "#FFF1F2", color: "#E11D48" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={changingPassword}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #D4A853, #C49B3D)" }}
            >
              {changingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
              {changingPassword ? "변경 중..." : "비밀번호 변경"}
            </button>
          </form>
        </div>
      </div>
    );
  }

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
          {showEmailLogin ? "관리자 이메일로 로그인" : "전화번호와 비밀번호를 입력하세요"}
        </p>

        {showEmailLogin ? (
          // 이메일 로그인 (관리자)
          <form onSubmit={handleEmailLogin} className="space-y-3.5">
            <div>
              <label className="block mb-1.5 text-xs font-semibold" style={{ color: "#64748B" }}>
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@nk.com"
                required
                className="w-full px-3.5 py-2.5 rounded-[7px] text-[13.5px] outline-none transition-all"
                style={{ border: "1.5px solid #E2E8F0", color: "#1E293B" }}
              />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-semibold" style={{ color: "#64748B" }}>
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                required
                className="w-full px-3.5 py-2.5 rounded-[7px] text-[13.5px] outline-none transition-all"
                style={{ border: "1.5px solid #E2E8F0", color: "#1E293B" }}
              />
            </div>

            {error && (
              <div className="text-xs font-medium px-3 py-2 rounded-lg" style={{ background: "#FFF1F2", color: "#E11D48" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-[10px] text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1.5"
              style={{ background: "linear-gradient(135deg, #D4A853, #C49B3D)", boxShadow: "0 2px 8px rgba(212,168,83,0.3)" }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "로그인 중..." : "관리자 로그인"}
            </button>

            <div className="text-center mt-3">
              <button
                type="button"
                onClick={() => { setShowEmailLogin(false); setError(""); }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                전화번호로 로그인
              </button>
            </div>
          </form>
        ) : (
          // 전화번호 로그인 (선생님)
          <form onSubmit={handlePhoneLogin} className="space-y-3.5">
            <div>
              <label className="block mb-1.5 text-xs font-semibold" style={{ color: "#64748B", letterSpacing: "0.03em" }}>
                전화번호
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="010-0000-0000"
                required
                className="w-full px-3.5 py-2.5 rounded-[7px] text-[13.5px] outline-none transition-all"
                style={{ border: "1.5px solid #E2E8F0", color: "#1E293B", background: "#FFFFFF" }}
              />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-semibold" style={{ color: "#64748B", letterSpacing: "0.03em" }}>
                비밀번호
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="4자리 숫자"
                required
                className="w-full px-3.5 py-2.5 rounded-[7px] text-[13.5px] outline-none transition-all text-center tracking-[0.3em]"
                style={{ border: "1.5px solid #E2E8F0", color: "#1E293B", background: "#FFFFFF" }}
              />
            </div>

            {error && (
              <div className="text-xs font-medium px-3 py-2 rounded-lg" style={{ background: "#FFF1F2", color: "#E11D48" }}>
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

            <div className="text-center mt-3 space-y-2">
              <button
                type="button"
                onClick={() => { setShowEmailLogin(true); setError(""); setPassword(""); }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                관리자 이메일로 로그인
              </button>
            </div>

            {/* 보안: 개발 환경에서만 테스트 로그인 버튼 노출 */}
            {process.env.NODE_ENV === "development" && (
              <div className="text-center mt-4">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleQuickLogin}
                  className="py-2.5 px-5 rounded-[10px] text-[12.5px] font-medium transition-all disabled:opacity-50"
                  style={{ background: "none", border: "1.5px solid #E2E8F0", color: "#475569" }}
                >
                  테스트 계정으로 로그인
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
