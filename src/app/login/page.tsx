"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { phoneToEmail, toAuthPassword } from "@/lib/auth";
import { getTeacherByPhone, changeTeacherPassword } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";

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
      <div className="min-h-screen flex items-center justify-center bg-background px-4 text-foreground">
        <div className="w-full max-w-[400px] rounded-2xl border border-border bg-card p-8 shadow-[0_22px_60px_rgba(94,147,172,0.16)]">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 bg-primary text-lg font-extrabold text-primary-foreground shadow-[0_10px_28px_rgba(94,147,172,0.24)]">
              NK
            </div>
            <h2 className="text-lg font-bold text-foreground">비밀번호 변경</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {teacherName} 선생님, 새로운 비밀번호를 설정해주세요
            </p>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-muted-foreground">
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
                className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-center text-sm font-bold tracking-[0.5em] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
                autoFocus
              />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-muted-foreground">
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
                className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-center text-sm font-bold tracking-[0.5em] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={changingPassword}
              className="h-11 w-full rounded-xl font-semibold"
            >
              {changingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
              {changingPassword ? "변경 중..." : "비밀번호 변경"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Left - Branding */}
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden bg-[linear-gradient(135deg,var(--primary-soft)_0%,var(--secondary)_100%)] lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_26%_24%,rgba(255,255,255,0.52),transparent_34%),radial-gradient(circle_at_72%_76%,rgba(255,224,178,0.34),transparent_36%)]" />
        <div className="relative text-center max-w-[360px]">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 bg-primary text-2xl font-extrabold text-primary-foreground shadow-[0_14px_38px_rgba(94,147,172,0.26)]">
            NK
          </div>
          <h1 className="mb-2.5 text-[26px] font-extrabold text-foreground">
            NK Academy
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            학원 상담 관리 시스템
          </p>
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="flex w-full flex-col justify-center border-l border-border bg-card px-7 py-12 shadow-[0_0_60px_rgba(94,147,172,0.10)] sm:px-11 lg:w-[440px] lg:rounded-l-[24px]">
        <h2 className="mb-1 text-[22px] font-bold text-foreground">
          로그인
        </h2>
        <p className="mb-8 text-[13px] text-muted-foreground">
          {showEmailLogin ? "관리자 이메일로 로그인" : "전화번호와 비밀번호를 입력하세요"}
        </p>

        {showEmailLogin ? (
          // 이메일 로그인 (관리자)
          <form onSubmit={handleEmailLogin} className="space-y-3.5">
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-muted-foreground">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@nk.com"
                required
                className="w-full rounded-[7px] border border-border bg-card px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-muted-foreground">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                required
                className="w-full rounded-[7px] border border-border bg-card px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="mt-1.5 h-11 w-full rounded-[10px] font-semibold"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "로그인 중..." : "관리자 로그인"}
            </Button>

            <div className="text-center mt-3">
              <button
                type="button"
                onClick={() => { setShowEmailLogin(false); setError(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                전화번호로 로그인
              </button>
            </div>
          </form>
        ) : (
          // 전화번호 로그인 (선생님)
          <form onSubmit={handlePhoneLogin} className="space-y-3.5">
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-muted-foreground">
                전화번호
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="010-0000-0000"
                required
                className="w-full rounded-[7px] border border-border bg-card px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-muted-foreground">
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
                className="w-full rounded-[7px] border border-border bg-card px-3.5 py-2.5 text-center text-[13.5px] tracking-[0.3em] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="mt-1.5 h-11 w-full rounded-[10px] font-semibold"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "로그인 중..." : "로그인"}
            </Button>

            <div className="text-center mt-3 space-y-2">
              <button
                type="button"
                onClick={() => { setShowEmailLogin(true); setError(""); setPassword(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
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
                  className="rounded-[10px] border border-border bg-transparent px-5 py-2.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
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
