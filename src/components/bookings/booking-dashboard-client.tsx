"use client";

import { useState, useCallback, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Copy, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/empty-state";
import {
  getBookings,
  getBlockedSlots,
  toggleBookingPaid,
  toggleBlockedSlot,
  toggleBlockedDate,
  deleteBooking,
} from "@/lib/actions/booking";
import { BRANCHES, BOOKING_SUBJECTS, type Booking, type BlockedSlot } from "@/types";

// ========== 유틸 ==========

const ALL_HOURS = [13, 14, 15, 16, 17, 18, 19, 20];
const HOURS_WEEKDAY = [15, 16, 17, 18, 19, 20];
const HOURS_SAT = [13, 14, 15, 16];
const DAYS_KR = ["일", "월", "화", "수", "목", "금", "토"];

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

// ========== Props ==========

interface Props {
  initialBookings: Booking[];
  initialBlocked: BlockedSlot[];
  initialTotal: number;
}

export function BookingDashboardClient({ initialBookings, initialBlocked, initialTotal }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [weekOffset, setWeekOffset] = useState(0);
  const [filter, setFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showNotice, setShowNotice] = useState<Booking | null>(null);
  const [showDelete, setShowDelete] = useState<Booking | null>(null);
  const [copied, setCopied] = useState(false);

  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [blocked, setBlocked] = useState<BlockedSlot[]>(initialBlocked);

  const dates = getWeekDates(weekOffset);

  // 데이터 새로고침
  const refreshData = useCallback(async (offset: number) => {
    const ds = getWeekDates(offset);
    const start = fmt(ds[0]);
    const end = fmt(ds[5]);
    const [bRes, blRes] = await Promise.all([
      getBookings({ startDate: start, endDate: end, limit: 200 }),
      getBlockedSlots(start, end),
    ]);
    setBookings(bRes.data);
    setBlocked(blRes);
  }, []);

  const handleWeekChange = (newOffset: number) => {
    setWeekOffset(newOffset);
    refreshData(newOffset);
  };

  // 예약→슬롯 맵
  const bookingMap: Record<string, Booking> = {};
  for (const b of bookings) {
    bookingMap[sKey(b.booking_date, b.booking_hour, b.branch)] = b;
  }

  const blockedMap: Record<string, boolean> = {};
  for (const bl of blocked) {
    blockedMap[`${bl.slot_date}_${bl.slot_hour}_${bl.branch}`] = true;
  }

  // 통계
  const stats = {
    total: initialTotal,
    paid: bookings.filter((b) => b.paid).length,
    unpaid: bookings.filter((b) => !b.paid).length,
  };

  // 필터
  const today = new Date().toISOString().split("T")[0];
  const filteredBookings = bookings
    .filter((b) => {
      if (filter === "unpaid") return !b.paid;
      if (filter === "today") return b.booking_date === today;
      return true;
    })
    .sort((a, b) =>
      a.booking_date === b.booking_date
        ? a.booking_hour - b.booking_hour
        : a.booking_date.localeCompare(b.booking_date)
    );

  // 입금 토글
  const handleTogglePaid = (booking: Booking) => {
    startTransition(async () => {
      const result = await toggleBookingPaid(booking.id);
      if (result.success) {
        setBookings((prev) =>
          prev.map((b) => (b.id === booking.id ? { ...b, paid: !b.paid } : b))
        );
        toast.success(result.paid ? "예약 확정 (입금 확인)" : "대기 상태로 변경");
      } else {
        toast.error(result.error || "변경 실패");
      }
    });
  };

  // 시간 차단 토글
  const handleBlockSlot = (dateStr: string, hour: number, branchId: string) => {
    startTransition(async () => {
      const result = await toggleBlockedSlot(dateStr, hour, branchId);
      if (result.success) {
        if (result.blocked) {
          setBlocked((prev) => [
            ...prev,
            { id: "temp", slot_date: dateStr, slot_hour: hour, branch: branchId, created_at: "" },
          ]);
        } else {
          setBlocked((prev) =>
            prev.filter((bl) => !(bl.slot_date === dateStr && bl.slot_hour === hour && bl.branch === branchId))
          );
        }
      } else {
        toast.error(result.error || "차단 변경 실패");
      }
    });
  };

  // 날짜 전체 차단/해제
  const handleBlockDate = (dateStr: string, branchId: string, hours: number[]) => {
    startTransition(async () => {
      const result = await toggleBlockedDate(dateStr, branchId, hours);
      if (result.success) {
        if (result.blocked) {
          // 해당 날짜+지점의 모든 시간 차단 추가
          const newBlocked = hours
            .filter((h) => !blocked.some((bl) => bl.slot_date === dateStr && bl.slot_hour === h && bl.branch === branchId))
            .map((h) => ({ id: `temp-${h}`, slot_date: dateStr, slot_hour: h, branch: branchId, created_at: "" }));
          setBlocked((prev) => [...prev, ...newBlocked]);
          toast.success("날짜 전체 차단 완료");
        } else {
          setBlocked((prev) =>
            prev.filter((bl) => !(bl.slot_date === dateStr && bl.branch === branchId && hours.includes(bl.slot_hour)))
          );
          toast.success("날짜 전체 차단 해제");
        }
      } else {
        toast.error(result.error || "날짜 차단 변경 실패");
      }
    });
  };

  // 삭제
  const handleDelete = () => {
    if (!showDelete) return;
    startTransition(async () => {
      const result = await deleteBooking(showDelete.id);
      if (result.success) {
        setBookings((prev) => prev.filter((b) => b.id !== showDelete.id));
        setShowDelete(null);
        toast.success("예약이 삭제되었습니다");
        router.refresh();
      } else {
        toast.error(result.error || "삭제 실패");
      }
    });
  };

  // 안내문 텍스트
  const getNoticeText = (b: Booking) => {
    const br = BRANCHES.find((x) => x.id === b.branch);
    const subjectLabel = BOOKING_SUBJECTS.find((s) => s.id === b.subject)?.label || "-";
    const consultLabel = b.consult_type === "inperson" ? "대면상담" : "유선상담";
    const consultTime = b.consult_type === "inperson" ? `${b.booking_hour + 1}:00~${b.booking_hour + 1}:30` : "별도 안내";

    return `[NK Academy 상담 안내문]\n\n안녕하세요, ${b.parent_name} 학부모님.\nNK Academy에 관심을 가져주셔서 감사합니다.\n\n■ 학생 정보\n  학생명: ${b.student_name}\n  학교/학년: ${b.school || ""} ${b.grade || ""}\n  과목: ${subjectLabel}\n  현재 진도: ${b.progress || "미기재"}\n\n■ 테스트 안내\n  일시: ${b.booking_date} ${b.booking_hour}:00~${b.booking_hour + 1}:00\n  장소: NK Academy ${br?.label || ""}\n  테스트 비용: 10,000원\n\n■ 상담 안내\n  상담 유형: ${consultLabel}\n  상담 시간: ${consultTime}\n\n■ 입금 안내\n  테스트 비용 10,000원을 아래 계좌로 입금해주세요.\n  입금자명에 학생 이름을 기재해주세요.\n\n감사합니다.\nNK Academy 드림`;
  };

  const handleCopyNotice = (b: Booking) => {
    navigator.clipboard.writeText(getNoticeText(b));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold" style={{ color: "#0F172A", letterSpacing: "-0.02em", marginBottom: "3px" }}>
          예약 현황판
        </h1>
        <p className="text-[12.5px]" style={{ color: "#64748B" }}>
          총 {stats.total}건 (확정 {stats.paid} / 대기 {stats.unpaid})
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "전체", val: stats.total, color: "#6366f1", bg: "rgba(99,102,241,0.06)" },
          { label: "확정", val: stats.paid, color: "#059669", bg: "rgba(5,150,105,0.06)" },
          { label: "대기", val: stats.unpaid, color: "#dc2626", bg: "rgba(220,38,38,0.05)" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center"
          >
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{s.label}</div>
            <div className="text-2xl font-extrabold" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* 주간 현황 캘린더 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-slate-800">
            주간 현황
            <span className="text-[10px] text-slate-400 font-normal ml-2">클릭 = 시간 차단/해제</span>
          </h3>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="rounded-lg h-7 px-2" onClick={() => handleWeekChange(weekOffset - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-semibold text-slate-600 min-w-[140px] text-center">
              {fmtKR(dates[0])} ~ {fmtKR(dates[5])}
            </span>
            <Button variant="outline" size="sm" className="rounded-lg h-7 px-2" onClick={() => handleWeekChange(weekOffset + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {BRANCHES.map((br) => (
          <div key={br.id} className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <span
                className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-extrabold"
                style={{ background: br.color + "18", color: br.color }}
              >
                {br.icon}
              </span>
              <span className="text-[11px] font-bold" style={{ color: br.color }}>{br.label}</span>
            </div>
            <div className="grid gap-1 overflow-x-auto" style={{ gridTemplateColumns: "46px repeat(6, 1fr)", minWidth: 500 }}>
              <div />
              {dates.map((d) => {
                const ds = fmt(d);
                const validHours = getHoursForDate(d);
                const allBlockedForDate = validHours.every((h) => blockedMap[`${ds}_${h}_${br.id}`]);
                return (
                  <div key={ds} className="text-center py-0.5">
                    <div
                      className="text-[10px] font-semibold"
                      style={{ color: d.getDay() === 6 ? "#6366f1" : "#94a3b8" }}
                    >
                      {fmtKR(d)}
                    </div>
                    <button
                      onClick={() => handleBlockDate(ds, br.id, validHours)}
                      disabled={isPending}
                      className="text-[8px] font-bold px-1.5 py-0.5 rounded transition-all mt-0.5"
                      style={{
                        background: allBlockedForDate ? "rgba(220,38,38,0.1)" : "rgba(100,116,139,0.06)",
                        color: allBlockedForDate ? "#dc2626" : "#94a3b8",
                        border: `1px solid ${allBlockedForDate ? "rgba(220,38,38,0.2)" : "transparent"}`,
                      }}
                      title={allBlockedForDate ? "날짜 전체 차단 해제" : "날짜 전체 차단"}
                    >
                      {allBlockedForDate ? "✕ 전체해제" : "전체차단"}
                    </button>
                  </div>
                );
              })}
              {ALL_HOURS.map((h) => (
                <Fragment key={`${br.id}-${h}`}>
                  <div className="text-[10px] font-semibold text-slate-400 flex items-center justify-end pr-1">
                    {h}:00
                  </div>
                  {dates.map((d) => {
                    const ds = fmt(d);
                    const validHours = getHoursForDate(d);
                    const isValid = validHours.includes(h);
                    const bk = isValid ? bookingMap[sKey(ds, h, br.id)] : undefined;
                    const bl = isValid ? blockedMap[`${ds}_${h}_${br.id}`] : false;
                    const past = isPast(d, h);
                    return (
                      <div
                        key={`${ds}${h}`}
                        onClick={() => {
                          if (!isValid || past) return;
                          if (bk) {
                            setSelectedBooking(bk);
                          } else {
                            handleBlockSlot(ds, h, br.id);
                          }
                        }}
                        title={!isValid ? "" : bk ? `${bk.student_name} (${bk.parent_name})` : bl ? "차단됨 (클릭 해제)" : "클릭으로 차단"}
                        className="rounded flex items-center justify-center text-[9px] font-semibold transition-all"
                        style={{
                          height: 26,
                          cursor: !isValid || past ? "default" : "pointer",
                          background: !isValid
                            ? "transparent"
                            : bk
                              ? bk.paid ? "rgba(5,150,105,0.1)" : "rgba(79,70,229,0.1)"
                              : bl ? "rgba(220,38,38,0.06)" : past ? "#f8fafc" : "#fff",
                          border: !isValid
                            ? "1px solid transparent"
                            : `1px solid ${bk ? (bk.paid ? "rgba(5,150,105,0.2)" : "rgba(79,70,229,0.2)") : bl ? "rgba(220,38,38,0.15)" : "#e2e8f0"}`,
                          color: bk ? (bk.paid ? "#059669" : "#6366f1") : bl ? "#dc2626" : "#94a3b8",
                        }}
                      >
                        {!isValid ? "" : bk ? (bk.paid ? "✓" : "●") : bl ? "✕" : ""}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        ))}
        <div className="flex gap-4 mt-2 text-[10px] text-slate-400">
          <span><span className="text-indigo-500">●</span> 대기</span>
          <span><span className="text-emerald-600">✓</span> 확정</span>
          <span><span className="text-red-500">✕</span> 차단</span>
        </div>
      </div>

      {/* 예약 목록 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-slate-800">예약 목록</h3>
          <div className="flex gap-1">
            {[
              { id: "all", label: "전체" },
              { id: "today", label: "오늘" },
              { id: "unpaid", label: "대기" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all"
                style={{
                  background: filter === f.id ? "#4f46e5" : "#f1f5f9",
                  color: filter === f.id ? "#fff" : "#94a3b8",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredBookings.length === 0 ? (
          <EmptyState
            icon={ChevronRight}
            title="예약이 없습니다"
            description={filter !== "all" ? "필터를 변경해보세요" : "아직 예약이 없습니다"}
          />
        ) : (
          <div className="space-y-2">
            {filteredBookings.map((b) => {
              const br = BRANCHES.find((x) => x.id === b.branch);
              const subjectLabel = BOOKING_SUBJECTS.find((s) => s.id === b.subject)?.label || "";
              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => setSelectedBooking(b)}
                >
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    <span className="font-bold text-sm text-slate-800">{b.student_name}</span>
                    <span className="text-[11px] text-slate-400">
                      {b.school} {b.grade} &middot; {subjectLabel}
                    </span>
                    {br && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold"
                        style={{ background: br.color + "18", color: br.color }}
                      >
                        {br.label}
                      </span>
                    )}
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold"
                      style={{
                        background: b.consult_type === "inperson" ? "rgba(217,119,6,0.06)" : "rgba(5,150,105,0.06)",
                        color: b.consult_type === "inperson" ? "#d97706" : "#059669",
                      }}
                    >
                      {b.consult_type === "inperson" ? "대면" : "유선"}
                    </span>
                    <span className="text-[11px] text-slate-400">{b.booking_date} {b.booking_hour}:00</span>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 rounded-lg"
                      onClick={(e) => { e.stopPropagation(); setShowNotice(b); }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleTogglePaid(b); }}
                      disabled={isPending}
                      className="px-3 py-1 rounded-md text-[10px] font-bold transition-all"
                      style={{
                        background: b.paid ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
                        color: b.paid ? "#059669" : "#dc2626",
                      }}
                    >
                      {b.paid ? "✓ 확정" : "대기(미입금)"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 예약 상세 모달 */}
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>예약 상세</DialogTitle>
          </DialogHeader>
          {selectedBooking && (() => {
            const b = selectedBooking;
            const br = BRANCHES.find((x) => x.id === b.branch);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    { l: "학생명", v: b.student_name },
                    { l: "학부모", v: b.parent_name },
                    { l: "연락처", v: b.phone },
                    { l: "관", v: br?.label || "-" },
                    { l: "학교", v: b.school || "-" },
                    { l: "학년", v: b.grade || "-" },
                    { l: "과목", v: BOOKING_SUBJECTS.find((s) => s.id === b.subject)?.label || "-" },
                    { l: "진도", v: b.progress || "-" },
                    { l: "상담유형", v: b.consult_type === "inperson" ? "대면상담" : "유선상담" },
                    { l: "테스트", v: `${b.booking_date} ${b.booking_hour}:00~${b.booking_hour + 1}:00` },
                    { l: "상태", v: b.paid ? "✓ 예약 확정" : "⏳ 대기 (미입금)" },
                  ].map((item) => (
                    <div key={item.l}>
                      <div className="text-xs text-slate-400 mb-0.5">{item.l}</div>
                      <div className="font-semibold text-slate-700">{item.v}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl flex-1"
                    onClick={() => { setShowNotice(b); setSelectedBooking(null); }}
                  >
                    <Copy className="h-4 w-4 mr-1.5" />
                    안내문
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => { setShowDelete(b); setSelectedBooking(null); }}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    삭제
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* 안내문 모달 */}
      <Dialog open={!!showNotice} onOpenChange={() => setShowNotice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>학부모 안내문</DialogTitle>
          </DialogHeader>
          {showNotice && (() => {
            const b = showNotice;
            const br = BRANCHES.find((x) => x.id === b.branch);
            const subjectLabel = BOOKING_SUBJECTS.find((s) => s.id === b.subject)?.label || "-";
            const consultLabel = b.consult_type === "inperson" ? "대면상담" : "유선상담";
            const consultTime = b.consult_type === "inperson"
              ? `${b.booking_hour + 1}:00~${b.booking_hour + 1}:30`
              : "별도 안내";
            return (
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-5 text-sm leading-relaxed space-y-3">
                  <div className="text-center">
                    <p className="text-lg font-extrabold text-slate-800">NK Academy</p>
                    <p className="text-xs text-slate-400">상담 안내문</p>
                    <div className="w-10 h-0.5 bg-indigo-500 mx-auto mt-2 rounded" />
                  </div>
                  <p>안녕하세요, <strong>{b.parent_name}</strong> 학부모님.</p>
                  <p>NK Academy에 관심을 가져주셔서 감사합니다.</p>
                  <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                    <p className="font-bold text-indigo-700 text-xs mb-1">학생 정보</p>
                    <p className="text-xs leading-loose">
                      학생명: <strong>{b.student_name}</strong><br />
                      학교/학년: <strong>{b.school} {b.grade}</strong><br />
                      과목: <strong>{subjectLabel}</strong><br />
                      현재 진도: <strong>{b.progress || "-"}</strong>
                    </p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                    <p className="font-bold text-emerald-700 text-xs mb-1">테스트 & 상담</p>
                    <p className="text-xs leading-loose">
                      일시: <strong>{b.booking_date} {b.booking_hour}:00~{b.booking_hour + 1}:00</strong><br />
                      장소: <strong>NK Academy {br?.label}</strong><br />
                      상담: <strong>{consultLabel} ({consultTime})</strong>
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                    <p className="font-bold text-amber-700 text-xs mb-1">입금 안내</p>
                    <p className="text-xs">
                      테스트 비용 <strong className="text-amber-600">10,000원</strong>을 입금해주세요.<br />
                      입금자명에 <strong>학생 이름</strong>을 기재해주세요.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => handleCopyNotice(b)}
                  className="w-full rounded-xl text-white"
                  style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
                >
                  {copied ? (
                    <><Check className="h-4 w-4 mr-1.5" /> 복사됨!</>
                  ) : (
                    <><Copy className="h-4 w-4 mr-1.5" /> 텍스트 복사</>
                  )}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>예약 삭제</DialogTitle>
            <DialogDescription>
              &quot;{showDelete?.student_name}&quot; 예약을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(null)} className="rounded-xl">
              취소
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending} className="rounded-xl">
              {isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
