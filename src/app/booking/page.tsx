"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBookingSlots, submitBooking } from "@/lib/actions/booking";
import { BRANCHES, BOOKING_SUBJECTS, BOOKING_GRADES } from "@/types";

// ========== 유틸 ==========

const HOURS_WEEKDAY = [15, 16, 17, 18, 19, 20];
const HOURS_SAT = [13, 14, 15, 16];
const ALL_HOURS = [13, 14, 15, 16, 17, 18, 19, 20];
const DAYS_KR = ["일", "월", "화", "수", "목", "금", "토"];

const CONSULT_TYPES = [
  { id: "phone", label: "유선상담", icon: "📞", desc: "별도 전화 상담 진행" },
  { id: "inperson", label: "대면상담", icon: "🤝", desc: "테스트 후 30분 대면상담" },
] as const;

function getHoursForDate(d: Date) {
  return d.getDay() === 6 ? HOURS_SAT : HOURS_WEEKDAY;
}

function getWeekDates(offset = 0) {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtKR(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}(${DAYS_KR[d.getDay()]})`;
}

function sKey(date: string, hour: number, branch: string) {
  return `${date}_${hour}_${branch}`;
}

function isPast(date: Date, hour: number) {
  const now = new Date();
  const s = new Date(date);
  s.setHours(hour, 0, 0, 0);
  return s < now;
}

// ========== 메인 ==========

export default function BookingPage() {
  const [step, setStep] = useState(0);
  const [branch, setBranch] = useState("");
  const [consultType, setConsultType] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; hour: number } | null>(null);
  const [parentName, setParentName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [phone, setPhone] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [progress, setProgress] = useState("");
  const [subject, setSubject] = useState("");
  const [payMethod, setPayMethod] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountCopied, setAccountCopied] = useState(false);

  // 예약/차단 상태
  const [bookedSlots, setBookedSlots] = useState<Record<string, { consult_type: string; paid: boolean }>>({});
  const [blockedSlots, setBlockedSlots] = useState<Record<string, boolean>>({});

  const dates = getWeekDates(weekOffset);

  const loadSlots = useCallback(async () => {
    const start = fmt(dates[0]);
    const end = fmt(dates[5]);
    const { bookings, blocked } = await getBookingSlots(start, end);

    const bMap: Record<string, { consult_type: string; paid: boolean }> = {};
    for (const b of bookings) {
      bMap[sKey(b.booking_date, b.booking_hour, b.branch)] = {
        consult_type: b.consult_type,
        paid: b.paid,
      };
    }

    const blMap: Record<string, boolean> = {};
    for (const bl of blocked) {
      blMap[`${bl.slot_date}_${bl.slot_hour}_${bl.branch}`] = true;
    }

    setBookedSlots(bMap);
    setBlockedSlots(blMap);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  useEffect(() => {
    if (step === 2 && branch) {
      loadSlots();
    }
  }, [step, branch, loadSlots]);

  const isUnavailable = (date: Date, hour: number): string | false => {
    const dateStr = fmt(date);
    const existing = bookedSlots[sKey(dateStr, hour, branch)];
    if (existing) {
      // 대면상담이 있으면 무조건 마감
      if (existing.consult_type === "inperson") return "booked";
      // 유선상담만 있는 경우: 대면상담 선택시 마감, 유선상담은 중복 허용
      if (consultType === "inperson") return "booked";
      // 유선상담 + 유선상담 → 중복 허용 (통과)
    }
    if (blockedSlots[`${dateStr}_${hour}_${branch}`]) return "blocked";
    const prev = bookedSlots[sKey(dateStr, hour - 1, branch)];
    if (prev && prev.consult_type === "inperson") return "consult";
    if (isPast(date, hour)) return "past";
    return false;
  };

  const handleSubmit = async () => {
    if (!parentName || !studentName || !phone || !school || !grade || !subject || !selectedSlot) return;
    setIsSubmitting(true);
    setError(null);

    const result = await submitBooking({
      branch,
      consult_type: consultType,
      booking_date: selectedSlot.date,
      booking_hour: selectedSlot.hour,
      student_name: studentName,
      parent_name: parentName,
      phone,
      school,
      grade,
      subject,
      progress: progress || undefined,
      pay_method: payMethod,
    });

    setIsSubmitting(false);
    if (result.success) {
      if (result.warning) {
        console.warn("[Booking]", result.warning);
      }
      setSubmitted(true);
    } else {
      setError(result.error || "예약에 실패했습니다");
    }
  };

  // ===== 완료 화면 =====
  if (submitted) {
    const br = BRANCHES.find((b) => b.id === branch);
    const subjectLabel = BOOKING_SUBJECTS.find((s) => s.id === subject)?.label || "";
    return (
      <div className="text-center py-12 space-y-4 animate-in fade-in">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-800">예약이 완료되었습니다</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          {br?.label} &middot; {selectedSlot?.date}<br />
          테스트 {selectedSlot?.hour}:00~{(selectedSlot?.hour ?? 0) + 1}:00<br />
          {consultType === "inperson"
            ? `대면상담 ${selectedSlot?.hour}:30~${(selectedSlot?.hour ?? 0) + 1}:30`
            : "유선상담 (별도 안내)"}<br />
          <span className="text-slate-400">{studentName} ({school} {grade}) &middot; {subjectLabel}</span>
        </p>
        {payMethod === "done" ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-left mt-4">
            <p className="text-sm font-bold text-emerald-700">예약이 확정되었습니다</p>
            <p className="text-xs text-emerald-600 mt-1">입금 확인 후 최종 안내 문자를 드리겠습니다.</p>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left mt-4">
            <p className="text-sm font-bold text-amber-700 mb-1">입금 안내 (예약 대기 중)</p>
            <p className="text-sm text-amber-600 leading-relaxed">
              테스트 비용 <strong>10,000원</strong>을 아래 계좌로 입금해주세요.<br />
              <strong>신한은행 110-383-883419 (노윤희)</strong><br />
              입금자명에 <strong>{studentName}</strong>을 기재해주세요.
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText("110383883419");
                setAccountCopied(true);
                setTimeout(() => setAccountCopied(false), 2000);
              }}
              className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: accountCopied ? "rgba(5,150,105,0.15)" : "rgba(217,119,6,0.15)",
                color: accountCopied ? "#059669" : "#b45309",
              }}
            >
              {accountCopied ? <><Check className="h-3 w-3" /> 복사됨</> : <><Copy className="h-3 w-3" /> 계좌번호 복사</>}
            </button>
            <p className="text-xs text-amber-500 mt-2">입금 확인 후 예약이 확정됩니다.</p>
          </div>
        )}
      </div>
    );
  }

  // ===== 단계별 스텝 =====
  const steps = ["관 선택", "상담 유형", "시간 선택", "정보 입력", "입금 안내"];

  return (
    <div className="space-y-5">
      {/* 진행 바 */}
      <div className="flex gap-1">
        {steps.map((label, i) => (
          <div key={i} className="flex-1">
            <div
              className="h-1 rounded-full mb-1.5 transition-all duration-400"
              style={{
                background: i <= step
                  ? "linear-gradient(90deg, #4f46e5, #7c3aed)"
                  : "#e2e8f0",
              }}
            />
            <div
              className="text-center transition-colors"
              style={{
                fontSize: "9px",
                fontWeight: i === step ? 700 : 500,
                color: i <= step ? "#6366f1" : "#94a3b8",
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* 에러 */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Step 0: 관 선택 */}
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-800">테스트 관 선택</h3>
            <p className="text-xs text-slate-400 mt-1">방문하실 관을 선택해주세요</p>
          </div>
          <div className="flex flex-col gap-3">
            {BRANCHES.map((b) => (
              <button
                key={b.id}
                onClick={() => { setBranch(b.id); setStep(1); }}
                className="flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left"
                style={{
                  background: branch === b.id ? b.color + "12" : "#fff",
                  borderColor: branch === b.id ? b.color : "#e2e8f0",
                }}
              >
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center text-lg font-extrabold"
                  style={{ background: b.color + "15", color: b.color }}
                >
                  {b.icon}
                </div>
                <span className="font-bold text-base text-slate-800">{b.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: 상담 유형 */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-800">상담 유형 선택</h3>
            <p className="text-xs text-slate-400 mt-1">원하시는 상담 방식을 선택해주세요</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {CONSULT_TYPES.map((ct) => (
              <button
                key={ct.id}
                onClick={() => { setConsultType(ct.id); setStep(2); }}
                className="flex flex-col items-center p-6 rounded-xl border-2 transition-all gap-2"
                style={{
                  background: consultType === ct.id ? "rgba(79,70,229,0.06)" : "#fff",
                  borderColor: consultType === ct.id ? "#4f46e5" : "#e2e8f0",
                }}
              >
                <span className="text-3xl">{ct.icon}</span>
                <span className="font-bold text-base text-slate-800">{ct.label}</span>
                <span className="text-xs text-slate-400">{ct.desc}</span>
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => setStep(0)} className="rounded-xl">
            <ChevronLeft className="h-4 w-4 mr-1" /> 이전
          </Button>
        </div>
      )}

      {/* Step 2: 시간 선택 */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-800">시간 선택</h3>
            <div className="flex gap-1.5 mt-2">
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold"
                style={{
                  background: (BRANCHES.find((b) => b.id === branch)?.color ?? "#666") + "18",
                  color: BRANCHES.find((b) => b.id === branch)?.color,
                }}
              >
                {BRANCHES.find((b) => b.id === branch)?.label}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-600">
                {consultType === "inperson" ? "대면상담" : "유선상담"}
              </span>
            </div>
          </div>

          {/* 주간 네비게이션 */}
          <div className="flex justify-between items-center">
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setWeekOffset((w) => w - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-semibold text-slate-600">
              {fmtKR(dates[0])} ~ {fmtKR(dates[5])}
            </span>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setWeekOffset((w) => w + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* 시간표 그리드 */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 overflow-x-auto shadow-sm">
            <div className="grid gap-1" style={{ gridTemplateColumns: "46px repeat(6, 1fr)", minWidth: 400 }}>
              <div />
              {dates.map((d) => (
                <div
                  key={fmt(d)}
                  className="text-center text-[10px] font-semibold py-1"
                  style={{ color: d.getDay() === 6 ? "#6366f1" : "#94a3b8" }}
                >
                  {fmtKR(d)}
                </div>
              ))}
              {ALL_HOURS.map((h) => (
                <Fragment key={h}>
                  <div className="text-[10px] font-semibold text-slate-400 flex items-center justify-end pr-1">
                    {h}:00
                  </div>
                  {dates.map((d) => {
                    const ds = fmt(d);
                    const validHours = getHoursForDate(d);
                    const isValid = validHours.includes(h);
                    const status = isValid ? isUnavailable(d, h) : "invalid";
                    const isSel = selectedSlot?.date === ds && selectedSlot?.hour === h;
                    return (
                      <button
                        key={`${ds}${h}`}
                        disabled={!!status}
                        onClick={() => isValid && setSelectedSlot({ date: ds, hour: h })}
                        className="rounded-md text-[10px] font-semibold transition-all"
                        style={{
                          padding: "8px 2px",
                          cursor: status ? "not-allowed" : "pointer",
                          border: isSel ? "2px solid #4f46e5" : status === "invalid" ? "1px solid transparent" : "1px solid #e2e8f0",
                          background: status === "invalid" ? "transparent"
                            : status === "booked" ? "rgba(220,38,38,0.05)"
                            : status === "blocked" ? "rgba(220,38,38,0.04)"
                            : status === "consult" ? "rgba(217,119,6,0.06)"
                            : status === "past" ? "#f8fafc"
                            : isSel ? "rgba(79,70,229,0.08)" : "#f8fafc",
                          color: status === "invalid" ? "transparent"
                            : status ? "#94a3b8"
                            : isSel ? "#4f46e5" : "#059669",
                        }}
                      >
                        {status === "invalid" ? "" : status === "booked" ? "마감" : status === "blocked" ? "✕" : status === "consult" ? "상담" : status === "past" ? "-" : "가능"}
                      </button>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>

          {selectedSlot && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm font-semibold text-indigo-600">
              ✓ 테스트 {selectedSlot.hour}:00~{selectedSlot.hour + 1}:00
              {consultType === "inperson" && ` → 상담 ${selectedSlot.hour}:30~${selectedSlot.hour + 1}:30`}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="rounded-xl">
              <ChevronLeft className="h-4 w-4 mr-1" /> 이전
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!selectedSlot}
              className="flex-1 rounded-xl text-white"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
            >
              다음 <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: 정보 입력 */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-800">정보 입력</h3>
            <p className="text-xs text-slate-400 mt-1">학생 및 학부모 정보를 입력해주세요</p>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">학생 이름 *</label>
                <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="홍길동" className="rounded-lg" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">학부모 성함 *</label>
                <Input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="홍길동" className="rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">연락처 *</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className="rounded-lg" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">학교 *</label>
                <Input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="안산중학교" className="rounded-lg" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">학년 *</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                >
                  <option value="">선택</option>
                  {BOOKING_GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">현재 진도</label>
              <Input value={progress} onChange={(e) => setProgress(e.target.value)} placeholder="예: 중2 일차방정식, 영문법 기초 등" className="rounded-lg" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-2">과목 선택 *</label>
              <div className="grid grid-cols-3 gap-2">
                {BOOKING_SUBJECTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSubject(s.id)}
                    className="p-3 rounded-xl border-2 transition-all text-center"
                    style={{
                      background: subject === s.id ? "rgba(79,70,229,0.06)" : "#f8fafc",
                      borderColor: subject === s.id ? "#4f46e5" : "#e2e8f0",
                    }}
                  >
                    <div className="text-base font-extrabold" style={{ color: subject === s.id ? "#4f46e5" : "#94a3b8" }}>{s.icon}</div>
                    <div className="text-xs font-bold mt-0.5" style={{ color: subject === s.id ? "#4f46e5" : "#1e293b" }}>{s.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)} className="rounded-xl">
              <ChevronLeft className="h-4 w-4 mr-1" /> 이전
            </Button>
            <Button
              onClick={() => setStep(4)}
              disabled={!parentName || !studentName || !phone || !school || !grade || !subject}
              className="flex-1 rounded-xl text-white"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
            >
              다음 <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: 입금 안내 */}
      {step === 4 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-800">입금 안내</h3>
            <p className="text-xs text-slate-400 mt-1">입금 완료 시 예약이 확정됩니다</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
            <div className="text-xs text-slate-400 mb-1">테스트 비용</div>
            <div className="text-3xl font-extrabold text-amber-500 mb-3">₩ 10,000</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-amber-700">계좌 정보</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText("110383883419");
                  setAccountCopied(true);
                  setTimeout(() => setAccountCopied(false), 2000);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
                style={{
                  background: accountCopied ? "rgba(5,150,105,0.12)" : "rgba(217,119,6,0.12)",
                  color: accountCopied ? "#059669" : "#b45309",
                }}
              >
                {accountCopied ? <><Check className="h-3 w-3" /> 복사됨</> : <><Copy className="h-3 w-3" /> 계좌 복사</>}
              </button>
            </div>
            <div className="text-sm text-amber-800 leading-relaxed">
              <p><strong>신한은행 110-383-883419</strong></p>
              <p>예금주: <strong>노윤희</strong></p>
            </div>
            <p className="text-xs text-amber-600 mt-2">
              입금자명에 <strong>{studentName}</strong> 기재해주세요
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {[
              { id: "done", label: "입금 완료", desc: "이미 입금을 완료했습니다", icon: "✓" },
              { id: "will", label: "입금 예정", desc: "확인 후 입금 예정입니다", icon: "⏳" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPayMethod(p.id)}
                className="flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left"
                style={{
                  background: payMethod === p.id ? "rgba(79,70,229,0.06)" : "#f8fafc",
                  borderColor: payMethod === p.id ? "#4f46e5" : "#e2e8f0",
                }}
              >
                <span className="text-lg">{p.icon}</span>
                <div>
                  <div className="font-bold text-sm text-slate-800">{p.label}</div>
                  <div className="text-xs text-slate-400">{p.desc}</div>
                </div>
              </button>
            ))}
          </div>
          {payMethod === "will" && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              입금 확인 후 예약이 확정됩니다. 입금 전까지는 예약 대기 상태입니다.
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(3)} className="rounded-xl">
              <ChevronLeft className="h-4 w-4 mr-1" /> 이전
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!payMethod || isSubmitting}
              className="flex-1 rounded-xl text-white"
              style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> 처리 중...</>
              ) : (
                payMethod === "done" ? "예약 확정 ✓" : "예약 접수"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
