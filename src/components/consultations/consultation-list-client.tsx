"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  RefreshCw,
  Plus,
  FileText,
  ClipboardCopy,
  Pencil,
  Check,
  Circle,
  LayoutGrid,
  Calendar,
  Trash2,
  Search,
} from "lucide-react";
import { ConsultationFormDialog } from "@/components/consultations/consultation-form-client";
import { TextParseModal } from "@/components/consultations/text-parse-modal";
import { updateConsultationField, deleteConsultation } from "@/lib/actions/consultation";
import type { Consultation, ResultStatus } from "@/types";

interface Props {
  initialData: Consultation[];
  initialPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  classes?: { id: string; name: string }[];
}

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatGroupDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} (${DAY_NAMES[d.getDay()]})`;
}

function formatHeaderDate(): string {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${DAY_NAMES[d.getDay()]}요일`;
}

function shortLocation(loc: string | null): { text: string; cls: string } {
  if (!loc) return { text: "-", cls: "" };
  if (loc.includes("B동 4층")) return { text: "B4층", cls: "bg-indigo-100 text-indigo-700" };
  if (loc.includes("A동 7층")) return { text: "A7층", cls: "bg-sky-100 text-sky-700" };
  if (loc.includes("자이")) return { text: "자이", cls: "bg-orange-100 text-orange-700" };
  return { text: loc.slice(0, 4), cls: "bg-gray-100 text-gray-600" };
}

function subjectBadge(subj: string | null): { text: string; cls: string } {
  if (!subj) return { text: "-", cls: "" };
  const s = subj.toLowerCase();
  if (s.includes("영어") && s.includes("수학"))
    return { text: "영어, 수학", cls: "bg-purple-100 text-purple-700" };
  if (s.includes("영수"))
    return { text: "영어, 수학", cls: "bg-purple-100 text-purple-700" };
  if (s.includes("수학")) return { text: "수학", cls: "bg-emerald-100 text-emerald-700" };
  if (s.includes("영어")) return { text: "영어", cls: "bg-blue-100 text-blue-700" };
  return { text: subj, cls: "bg-gray-100 text-gray-600" };
}

function formatMethod(type: string): { text: string; isInPerson: boolean } {
  if (type.includes("유선")) return { text: "유선", isInPerson: false };
  if (type.includes("대면")) {
    const timeMatch = type.match(/(\d{1,2}:\d{2})/);
    const time = timeMatch ? ` ${timeMatch[1]}` : "";
    return { text: `대면${time}`, isInPerson: true };
  }
  return { text: type, isInPerson: false };
}

function formatPlanDate(d: string | null): string {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// 결과에 따른 행 스타일
function rowStyleByResult(status: string): string {
  if (status === "registered") return "bg-red-50";
  if (status === "hold") return "bg-amber-50";
  if (status === "other") return "bg-neutral-900 text-neutral-400";
  return "";
}

// 고정 컬럼 너비 (colgroup) — 한 화면에 맞추기
const COL_WIDTHS = [48, 56, 72, 60, 44, 68, 100, 110, 76, 190, 76];

export function ConsultationListClient({ initialData, initialPagination, classes = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingConsultation, setEditingConsultation] = useState<Consultation | undefined>();
  const [showTextParse, setShowTextParse] = useState(false);
  const [localData, setLocalData] = useState(initialData);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setLocalData(initialData);
  }, [initialData]);

  const filteredData = searchQuery.trim()
    ? localData.filter((c) => {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.school && c.school.toLowerCase().includes(q)) ||
          (c.parent_phone && c.parent_phone.includes(q)) ||
          (c.grade && c.grade.toLowerCase().includes(q))
        );
      })
    : localData;

  const grouped = filteredData.reduce<Record<string, Consultation[]>>((acc, item) => {
    const date = item.consult_date || "unknown";
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const today = getTodayStr();

  const handleToggleField = useCallback(
    (id: string, field: string, current: boolean) => {
      setLocalData((prev) =>
        prev.map((c) => (c.id === id ? { ...c, [field]: !current } : c))
      );
      startTransition(async () => {
        const result = await updateConsultationField(id, field, !current);
        if (!result.success) {
          setLocalData((prev) =>
            prev.map((c) => (c.id === id ? { ...c, [field]: current } : c))
          );
          toast.error("업데이트 실패");
        }
      });
    },
    [startTransition]
  );

  const handleResultChange = useCallback(
    (id: string, value: string) => {
      const prev = localData.find((c) => c.id === id);
      if (!prev) return;
      const newValue = prev.result_status === value ? "none" : value;
      setLocalData((data) =>
        data.map((c) =>
          c.id === id ? { ...c, result_status: newValue as ResultStatus } : c
        )
      );
      startTransition(async () => {
        const result = await updateConsultationField(id, "result_status", newValue);
        if (!result.success) {
          setLocalData((data) =>
            data.map((c) =>
              c.id === id ? { ...c, result_status: prev.result_status } : c
            )
          );
          toast.error("업데이트 실패");
        }
      });
    },
    [localData, startTransition]
  );

  const handleCopy = useCallback((c: Consultation) => {
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

    const fmtDate = (ds: string | null): string => {
      if (!ds) return "";
      const d = new Date(ds + "T00:00:00");
      return `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})`;
    };

    const fmtTime = (ts: string | null): string => {
      if (!ts) return "";
      const [h, m] = ts.split(":").map(Number);
      const period = h < 12 ? "오전" : "오후";
      const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return m > 0 ? `${period} ${dh}시 ${m}분` : `${period} ${dh}시`;
    };

    const fmtPhone = (p: string | null): string => {
      if (!p) return "";
      const digits = p.replace(/\D/g, "");
      if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
      if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
      return p;
    };

    const consultLine = (): string => {
      const ds = fmtDate(c.consult_date);
      if (c.consult_type?.includes("대면")) {
        const m = c.consult_type.match(/(\d{1,2}):(\d{2})/);
        if (m) {
          const h = parseInt(m[1]);
          const min = parseInt(m[2]);
          const dh = h > 12 ? h - 12 : h;
          const ts = min > 0 ? `${dh}시 ${min}분` : `${dh}시`;
          return `${ds} ${ts}에 진행됩니다.`;
        }
      }
      if (c.consult_type?.includes("유선")) return "유선으로 진행됩니다.";
      return `${ds}에 진행됩니다.`;
    };

    const lines = [
      "[NK test 안내]",
      `▶이름 : ${c.name}`,
      c.parent_phone ? `▶학부모 : ${fmtPhone(c.parent_phone)}` : null,
      c.school ? `▶학교 : ${c.school}${c.grade || ""}` : null,
      c.consult_date ? `▶일시 : ${fmtDate(c.consult_date)} ${fmtTime(c.consult_time)}` : null,
      c.subject ? `▶테스트 과목 : ${c.subject}` : null,
      "▶상담비용 : 과목당 1만원",
      "▶계좌 : 신한은행 110-383-883419  노윤희(학생명으로 입금 부탁드립니다.)",
      "▶준비물 : 필기도구",
      c.location ? `▶위치 : ${c.location}` : null,
      `▶학부모님 상담 : ${consultLine()}`,
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(lines);
    toast.success("클립보드에 복사되었습니다");
  }, []);

  const handleEdit = useCallback((c: Consultation) => {
    setEditingConsultation(c);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      if (!confirm(`"${name}" 상담을 삭제하시겠습니까?`)) return;
      setLocalData((prev) => prev.filter((c) => c.id !== id));
      startTransition(async () => {
        const result = await deleteConsultation(id);
        if (!result.success) {
          toast.error("삭제 실패");
          router.refresh();
        } else {
          toast.success("삭제되었습니다");
        }
      });
    },
    [startTransition, router]
  );

  const colGroup = (
    <colgroup>
      {COL_WIDTHS.map((w, i) => (
        <col key={i} style={{ width: `${w}px` }} />
      ))}
    </colgroup>
  );

  const tableHead = (
    <thead>
      <tr className="border-t border-b border-slate-200">
        {["시간", "이름", "학교", "과목", "장소", "방식", "연락처", "진행", "테스트비", "결과", ""].map(
          (label, i) => (
            <th
              key={i}
              className={`text-left py-2 px-1.5 text-[11px] font-semibold text-slate-400 whitespace-nowrap ${i < 10 ? "border-r border-slate-100" : ""}`}
            >
              {label}
            </th>
          )
        )}
      </tr>
    </thead>
  );

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-slate-700" />
            <span className="text-xl font-bold text-slate-800">상담 현황</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <Calendar className="h-4 w-4" />
            {formatHeaderDate()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="이름, 학교, 연락처 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 pr-3 rounded-lg text-sm bg-white border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 w-52"
            />
          </div>
          <button
            onClick={() => startTransition(() => router.refresh())}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowTextParse(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <FileText className="h-4 w-4" />
            텍스트 등록
          </button>
          <button
            onClick={() => {
              setEditingConsultation(undefined);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-colors"
            style={{
              background: "linear-gradient(135deg, #D4A853, #C49B3D)",
              boxShadow: "0 2px 8px rgba(212,168,83,0.25)",
            }}
          >
            <Plus className="h-4 w-4" />
            일정 추가
          </button>
        </div>
      </div>

      {/* Date Groups */}
      {sortedDates.map((date) => {
        const items = grouped[date];
        const isDateToday = date === today;

        return (
          <div key={date}>
            <div className="flex items-center gap-2 py-3">
              {isDateToday && (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-700 tracking-wide">
                  TODAY
                </span>
              )}
              <span className="text-sm font-bold text-slate-700">
                {formatGroupDate(date)}
              </span>
              <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                {items.length}건
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed" style={{ minWidth: "900px" }}>
                {colGroup}
                {tableHead}
                <tbody>
                  {items
                    .sort((a, b) => {
                      const t = (a.consult_time || "").localeCompare(b.consult_time || "");
                      return t !== 0 ? t : a.id.localeCompare(b.id);
                    })
                    .map((item) => {
                      const loc = shortLocation(item.location);
                      const subj = subjectBadge(item.subject);
                      const method = formatMethod(item.consult_type);
                      const isUnregistered = item.result_status === "other";
                      const cellStrike = isUnregistered ? "line-through" : "";
                      const vBorder = "border-r border-slate-100";
                      const vBorderDark = "border-r border-neutral-700";
                      const vb = isUnregistered ? vBorderDark : vBorder;

                      return (
                        <tr
                          key={item.id}
                          className={`border-t border-slate-100 transition-colors ${rowStyleByResult(item.result_status)} ${!isUnregistered ? "hover:bg-slate-50/80" : ""}`}
                        >
                          <td className={`py-2 px-1.5 font-semibold whitespace-nowrap ${cellStrike} ${vb} ${isUnregistered ? "text-neutral-500" : "text-slate-700"}`}>
                            {item.consult_time?.slice(0, 5) || "-"}
                          </td>
                          <td className={`py-2 px-1.5 font-bold whitespace-nowrap ${cellStrike} ${vb} ${isUnregistered ? "text-neutral-400" : "text-slate-800"}`}>
                            {item.name}
                          </td>
                          <td className={`py-2 px-1.5 text-xs whitespace-nowrap truncate ${cellStrike} ${vb} ${isUnregistered ? "text-neutral-500" : "text-slate-500"}`}>
                            {[item.school, item.grade].filter(Boolean).join(" ") || "-"}
                          </td>
                          <td className={`py-2 px-1.5 whitespace-nowrap ${cellStrike} ${vb}`}>
                            {isUnregistered ? (
                              <span className="text-neutral-500 text-xs">{subj.text}</span>
                            ) : subj.cls ? (
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${subj.cls}`}>
                                {subj.text}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td className={`py-2 px-1.5 whitespace-nowrap ${cellStrike} ${vb}`}>
                            {isUnregistered ? (
                              <span className="text-neutral-500 text-xs">{loc.text}</span>
                            ) : loc.cls ? (
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${loc.cls}`}>
                                {loc.text}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td className={`py-2 px-1.5 whitespace-nowrap ${cellStrike} ${vb}`}>
                            {isUnregistered ? (
                              <span className="text-neutral-500 text-xs">{method.text}</span>
                            ) : method.isInPerson ? (
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold border border-orange-300 bg-orange-50 text-orange-600">
                                {method.text}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-indigo-600">
                                {method.text}
                              </span>
                            )}
                          </td>
                          <td className={`py-2 px-1.5 text-xs font-mono whitespace-nowrap truncate ${cellStrike} ${vb} ${isUnregistered ? "text-neutral-500" : "text-slate-500"}`}>
                            {item.parent_phone || "-"}
                          </td>
                          <td className={`py-2 px-1.5 whitespace-nowrap ${vb}`}>
                            <div className="flex items-center gap-1">
                              {[
                                { field: "doc_sent", label: "자료", value: item.doc_sent },
                                { field: "call_done", label: "통화", value: item.call_done },
                                { field: "consult_done", label: "완료", value: item.consult_done },
                              ].map(({ field, label, value }) => (
                                <button
                                  key={field}
                                  onClick={() => handleToggleField(item.id, field, value)}
                                  className={`inline-flex items-center gap-0 text-[11px] transition-colors ${
                                    isUnregistered
                                      ? "text-neutral-600"
                                      : value
                                        ? "text-emerald-600 font-semibold"
                                        : "text-slate-400 hover:text-slate-600"
                                  }`}
                                >
                                  {value ? (
                                    <Check className={`h-3 w-3 ${isUnregistered ? "text-neutral-600" : "text-emerald-500"}`} />
                                  ) : (
                                    <Circle className="h-3 w-3" />
                                  )}
                                  {label}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className={`py-2 px-1.5 whitespace-nowrap ${vb}`}>
                            {isUnregistered ? (
                              <span className="text-neutral-500 text-xs">-</span>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    if (item.test_fee_paid) {
                                      // 납부 → 미납으로 토글
                                      handleToggleField(item.id, "test_fee_paid", true);
                                      startTransition(async () => {
                                        await updateConsultationField(item.id, "test_fee_method", null as unknown as string);
                                      });
                                      setLocalData((prev) =>
                                        prev.map((c) => c.id === item.id ? { ...c, test_fee_paid: false, test_fee_method: null } : c)
                                      );
                                    } else {
                                      // 미납 → 입금으로
                                      handleToggleField(item.id, "test_fee_paid", false);
                                      startTransition(async () => {
                                        await updateConsultationField(item.id, "test_fee_method", "transfer");
                                      });
                                      setLocalData((prev) =>
                                        prev.map((c) => c.id === item.id ? { ...c, test_fee_paid: true, test_fee_method: "transfer" } : c)
                                      );
                                    }
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                                    item.test_fee_paid
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "text-slate-400 hover:bg-slate-100"
                                  }`}
                                >
                                  {item.test_fee_paid ? "납부" : "미납"}
                                </button>
                                {item.test_fee_paid && (
                                  <button
                                    onClick={() => {
                                      const next = item.test_fee_method === "transfer" ? "card" : "transfer";
                                      setLocalData((prev) =>
                                        prev.map((c) => c.id === item.id ? { ...c, test_fee_method: next } : c)
                                      );
                                      startTransition(async () => {
                                        await updateConsultationField(item.id, "test_fee_method", next);
                                      });
                                    }}
                                    className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                                      item.test_fee_method === "card"
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-amber-100 text-amber-700"
                                    }`}
                                  >
                                    {item.test_fee_method === "card" ? "카드" : "입금"}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className={`py-2 px-1 whitespace-nowrap ${vb}`}>
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={() => handleResultChange(item.id, "registered")}
                                className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                                  item.result_status === "registered"
                                    ? "bg-red-500 text-white"
                                    : isUnregistered
                                      ? "text-neutral-600 hover:bg-neutral-800"
                                      : "text-slate-400 hover:bg-slate-100"
                                }`}
                              >
                                등록
                              </button>
                              <button
                                onClick={() => handleResultChange(item.id, "hold")}
                                className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                                  item.result_status === "hold"
                                    ? "bg-amber-400 text-white"
                                    : isUnregistered
                                      ? "text-neutral-600 hover:bg-neutral-800"
                                      : "text-slate-400 hover:bg-slate-100"
                                }`}
                              >
                                고민
                              </button>
                              <button
                                onClick={() => handleResultChange(item.id, "other")}
                                className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                                  item.result_status === "other"
                                    ? "bg-neutral-600 text-white line-through"
                                    : "text-slate-400 hover:bg-slate-100"
                                }`}
                              >
                                미등록
                              </button>
                              {item.plan_date && (
                                <button
                                  onClick={() =>
                                    handleToggleField(item.id, "notify_sent", item.notify_sent)
                                  }
                                  className={`inline-flex items-center gap-0 px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                                    isUnregistered
                                      ? item.notify_sent ? "bg-neutral-700 text-neutral-400" : "bg-neutral-800 text-neutral-500 border border-neutral-700"
                                      : item.notify_sent
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                                  }`}
                                >
                                  {item.notify_sent ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    <Circle className="h-3 w-3" />
                                  )}
                                  안내 {formatPlanDate(item.plan_date)}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-1.5 whitespace-nowrap">
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={() => handleCopy(item)}
                                className={`p-1.5 rounded transition-colors ${isUnregistered ? "text-neutral-600 hover:bg-neutral-800" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
                                title="클립보드 복사"
                              >
                                <ClipboardCopy className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleEdit(item)}
                                className={`p-1.5 rounded transition-colors ${isUnregistered ? "text-neutral-600 hover:bg-neutral-800" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
                                title="수정"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id, item.name)}
                                className="p-1.5 rounded transition-colors text-red-400 hover:bg-red-100 hover:text-red-600"
                                title="삭제"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {sortedDates.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <LayoutGrid className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-semibold mb-1">등록된 상담이 없습니다</p>
          <p className="text-sm">텍스트 등록 또는 일정 추가로 상담을 등록해보세요</p>
        </div>
      )}

      <ConsultationFormDialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditingConsultation(undefined);
        }}
        consultation={editingConsultation}
        classes={classes}
      />
      <TextParseModal open={showTextParse} onOpenChange={setShowTextParse} />
    </div>
  );
}
