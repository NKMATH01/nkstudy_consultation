"use client";

import { useState, useMemo, useTransition, useCallback, useEffect, Fragment } from "react";
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
  CalendarDays,
  Filter,
  Link2,
  MessageCircle,
  Send,
  XCircle,
} from "lucide-react";
import { ConsultationFormDialog } from "@/components/consultations/consultation-form-client";
import { TextParseModal } from "@/components/consultations/text-parse-modal";
import {
  cancelConsultation,
  updateConsultationField,
  deleteConsultation,
} from "@/lib/actions/consultation";
import { previewAlimtalk, sendAlimtalk } from "@/lib/actions/alimtalk";
import { createDripInvitation } from "@/lib/actions/drip-survey";
import {
  CONSULT_CONFIRM_TEMPLATE_CODE,
  buildConsultConfirmVars,
  type AlimtalkSendEntry,
  type AlimtalkSendMap,
} from "@/lib/consultation-alimtalk";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  alimtalkSendMap?: AlimtalkSendMap;
}

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const EMPTY_ALIMTALK_SEND_MAP: AlimtalkSendMap = {};

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

// 장소도 분류다. 앰버(경고)를 쓰면 자이점 상담만 문제가 있는 것처럼 읽힌다.
function shortLocation(loc: string | null): { text: string; cls: string } {
  if (!loc) return { text: "-", cls: "" };
  if (loc.includes("B동 4층")) return { text: "B4층", cls: "bg-nk-cat-1-soft text-nk-cat-1" };
  if (loc.includes("A동 7층")) return { text: "A7층", cls: "bg-nk-cat-1-soft text-nk-cat-1" };
  if (loc.includes("자이")) return { text: "자이", cls: "bg-nk-cat-4-soft text-nk-cat-4" };
  return { text: loc.slice(0, 4), cls: "bg-nk-sunken text-nk-ink-sub" };
}

// 과목은 상태가 아니라 분류다 — 초록·파랑(완료·진행) 대신 분류색을 쓴다.
function subjectBadge(subj: string | null): { text: string; cls: string } {
  if (!subj) return { text: "-", cls: "" };
  const s = subj.toLowerCase();
  if (s.includes("영어") && s.includes("수학"))
    return { text: "영어, 수학", cls: "bg-nk-cat-3-soft text-nk-cat-3" };
  if (s.includes("영수"))
    return { text: "영어, 수학", cls: "bg-nk-cat-3-soft text-nk-cat-3" };
  if (s.includes("수학")) return { text: "수학", cls: "bg-nk-cat-1-soft text-nk-cat-1" };
  if (s.includes("영어")) return { text: "영어", cls: "bg-nk-cat-2-soft text-nk-cat-2" };
  return { text: subj, cls: "bg-nk-sunken text-nk-ink-sub" };
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

function formatAlimtalkSendAt(sendAt: string): string {
  const date = new Date(sendAt);
  if (Number.isNaN(date.getTime())) return "-";

  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const hour = String(kst.getUTCHours()).padStart(2, "0");
  const minute = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${month}/${day} ${hour}:${minute}`;
}

function getAlimtalkButtonTitle(send?: AlimtalkSendEntry): string {
  if (!send) return "알림톡 발송";

  const sentAt = formatAlimtalkSendAt(send.sendAt);
  if (send.status === "failed") {
    return `알림톡 발송 실패 · ${sentAt} — 다시 시도 가능`;
  }
  return `알림톡 발송됨 · ${sentAt}`;
}

// 결과에 따른 행 스타일. 등록은 완료 초록, 고민중은 경고 앰버, 미등록은 가라앉힌 면이다 —
// 예전에는 등록이 붉은 면이었는데, 붉음은 이 체계에서 지연·위험 자리라 뜻이 반대로 읽혔다.
function rowStyleByResult(status: string): string {
  if (status === "registered") return "bg-nk-done-soft";
  if (status === "hold") return "bg-nk-warn-soft";
  if (status === "other") return "bg-nk-sunken text-nk-ink-hint";
  return "";
}

/** "YYYY-MM" 형식 반환 */
function getYearMonthFromDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const m = dateStr.match(/(\d{4})[.\-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  return null;
}

/** "YYYY-MM" → "25년 12월" 형식 표시 */
function formatYearMonth(ym: string): string {
  const [year, month] = ym.split("-");
  return `${year.slice(2)}년 ${parseInt(month)}월`;
}

const STATUS_FILTER_OPTIONS: { value: ResultStatus | null; label: string; cls: string; activeCls: string }[] = [
  { value: null, label: "전체", cls: "bg-nk-surface text-nk-ink-sub border-nk-line", activeCls: "bg-nk-navy text-nk-navy-ink border-nk-navy" },
  { value: "registered", label: "등록", cls: "bg-nk-surface text-nk-done border-nk-done", activeCls: "bg-nk-done text-nk-navy-ink border-nk-done" },
  { value: "hold", label: "고민중", cls: "bg-nk-surface text-nk-warn border-nk-warn", activeCls: "bg-nk-warn text-nk-navy-ink border-nk-warn" },
  { value: "other", label: "미등록", cls: "bg-nk-surface text-nk-wait border-nk-line", activeCls: "bg-nk-wait text-nk-navy-ink border-nk-wait" },
];

type AlimtalkPreviewState = {
  loading: boolean;
  data: {
    text: string;
    missing: string[];
    maskedPhone: string;
    sendable: boolean;
    template: {
      kakao_status: "draft" | "pending" | "approved" | "rejected";
    };
  } | null;
  error: string | null;
};

// 고정 컬럼 너비 (colgroup) — 한 화면에 맞추기
const COL_WIDTHS = [48, 56, 72, 60, 44, 68, 100, 110, 76, 190, 190];

function isNightTimeKSTClient(date: Date = new Date()): boolean {
  const kstHour = (date.getUTCHours() + 9) % 24;
  return kstHour >= 21 || kstHour < 8;
}

export function ConsultationListClient({
  initialData,
  initialPagination,
  classes = [],
  alimtalkSendMap = EMPTY_ALIMTALK_SEND_MAP,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingConsultation, setEditingConsultation] = useState<Consultation | undefined>();
  const [showTextParse, setShowTextParse] = useState(false);
  const [localData, setLocalData] = useState(initialData);
  const [localAlimtalkSendMap, setLocalAlimtalkSendMap] =
    useState<AlimtalkSendMap>(alimtalkSendMap);
  const [searchQuery, setSearchQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ResultStatus | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Consultation | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [alimtalkTarget, setAlimtalkTarget] = useState<Consultation | null>(null);
  const [alimtalkPreview, setAlimtalkPreview] = useState<AlimtalkPreviewState>({
    loading: false,
    data: null,
    error: null,
  });
  const [sendingAlimtalk, setSendingAlimtalk] = useState(false);

  useEffect(() => {
    setLocalData(initialData);
  }, [initialData]);

  useEffect(() => {
    setLocalAlimtalkSendMap(alimtalkSendMap);
  }, [alimtalkSendMap]);

  // 사용 가능한 월 목록 (최신순)
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    localData.forEach((c) => {
      const ym = getYearMonthFromDate(c.consult_date);
      if (ym) months.add(ym);
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [localData]);

  // 월별 + 등록상태 사전 필터링
  const preFiltered = useMemo(() => {
    let data = localData;
    if (monthFilter) {
      data = data.filter((c) => getYearMonthFromDate(c.consult_date) === monthFilter);
    }
    if (statusFilter) {
      data = data.filter((c) => c.result_status === statusFilter);
    }
    return data;
  }, [localData, monthFilter, statusFilter]);

  const filteredData = searchQuery.trim()
    ? preFiltered.filter((c) => {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.school && c.school.toLowerCase().includes(q)) ||
          (c.parent_phone && c.parent_phone.includes(q)) ||
          (c.grade && c.grade.toLowerCase().includes(q))
        );
      })
    : preFiltered;

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

    const parentConsultLine = (): string => {
      if (c.parent_consult_date) {
        const pds = fmtDate(c.parent_consult_date);
        const pts = c.parent_consult_time ? ` ${fmtTime(c.parent_consult_time)}` : "";
        const ploc = c.parent_location ? ` (${c.parent_location})` : "";
        return `${pds}${pts}${ploc}에 진행됩니다.`;
      }
      return consultLine();
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
      `▶학부모님 상담 : ${parentConsultLine()}`,
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(lines);
    toast.success("클립보드에 복사되었습니다");
  }, []);

  const handleOpenAlimtalk = useCallback(async (c: Consultation) => {
    setAlimtalkTarget(c);
    setAlimtalkPreview({ loading: true, data: null, error: null });

    const vars = buildConsultConfirmVars(c);
    const result = await previewAlimtalk({
      consultationId: c.id,
      templateCode: CONSULT_CONFIRM_TEMPLATE_CODE,
      vars,
    });

    if (!result.success || !result.data) {
      setAlimtalkPreview({
        loading: false,
        data: null,
        error: result.error ?? "미리보기 실패",
      });
      return;
    }

    setAlimtalkPreview({
      loading: false,
      data: result.data,
      error: null,
    });
  }, []);

  const handleCreateDripLink = useCallback(async (c: Consultation) => {
    const result = await createDripInvitation({
      consultationId: c.id,
      wave: "W1",
    });

    if (!result.success || !result.url) {
      toast.error(result.error ?? "링크 생성 실패");
      return;
    }

    await navigator.clipboard.writeText(result.url);
    toast.success("설문 링크가 복사되었습니다");
  }, []);

  const handleCloseAlimtalk = useCallback((open: boolean) => {
    if (open || sendingAlimtalk) return;
    setAlimtalkTarget(null);
    setAlimtalkPreview({ loading: false, data: null, error: null });
  }, [sendingAlimtalk]);

  const handleSendAlimtalk = useCallback(async () => {
    if (!alimtalkTarget) return;

    const vars = buildConsultConfirmVars(alimtalkTarget);
    setSendingAlimtalk(true);

    try {
      const result = await sendAlimtalk({
        consultationId: alimtalkTarget.id,
        templateCode: CONSULT_CONFIRM_TEMPLATE_CODE,
        vars,
        allowSmsFallback: true,
      });

      if (!result.success) {
        toast.error(result.error ?? "발송 실패");
        return;
      }

      toast.success("알림톡 발송 완료");
      setLocalAlimtalkSendMap((prev) => ({
        ...prev,
        [alimtalkTarget.id]: {
          status: "sent",
          sendAt: new Date().toISOString(),
        },
      }));
      const updateResult = await updateConsultationField(
        alimtalkTarget.id,
        "notify_sent",
        true,
      );

      if (!updateResult.success) {
        toast.error("발송 완료, 안내 상태 업데이트 실패");
      }

      setLocalData((prev) =>
        prev.map((c) =>
          c.id === alimtalkTarget.id ? { ...c, notify_sent: true } : c,
        ),
      );
      setAlimtalkTarget(null);
      setAlimtalkPreview({ loading: false, data: null, error: null });
    } finally {
      setSendingAlimtalk(false);
    }
  }, [alimtalkTarget]);

  const handleEdit = useCallback((c: Consultation) => {
    setEditingConsultation(c);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      if (!confirm(`"${name}" 상담을 완전히 삭제하시겠습니까? 화면에서는 사라지고 삭제 이력만 보존됩니다.`)) return;
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
      <tr className="border-t border-b border-nk-line-soft">
        {["시간", "이름", "학교", "과목", "장소", "방식", "연락처", "진행", "테스트비", "결과", ""].map(
          (label, i) => (
            <th
              key={i}
              className={`text-left py-2 px-1.5 text-[11px] font-semibold text-nk-ink-hint whitespace-nowrap ${i < 10 ? "border-r border-nk-line-soft" : ""}`}
            >
              {label}
            </th>
          )
        )}
      </tr>
    </thead>
  );

  const handleCancel = useCallback(() => {
    if (!cancelTarget) return;
    const target = cancelTarget;
    startTransition(async () => {
      const result = await cancelConsultation(target.id, cancelReason);
      if (!result.success) {
        toast.error(result.error || "상담 취소 실패");
        return;
      }
      setLocalData((prev) =>
        prev.map((consultation) =>
          consultation.id === target.id
            ? {
                ...consultation,
                status: "cancelled",
                status_changed_at: new Date().toISOString(),
                cancel_reason: cancelReason.trim() || null,
              }
            : consultation,
        ),
      );
      setCancelTarget(null);
      setCancelReason("");
      toast.success("상담이 취소되었습니다");
      router.refresh();
    });
  }, [cancelReason, cancelTarget, router, startTransition]);

  const alimtalkMissing = alimtalkPreview.data?.missing ?? [];
  const alimtalkTemplateUnapproved =
    !!alimtalkPreview.data &&
    alimtalkPreview.data.template.kakao_status !== "approved";
  const alimtalkSendDisabled =
    sendingAlimtalk ||
    alimtalkPreview.loading ||
    !!alimtalkPreview.error ||
    !alimtalkPreview.data ||
    !alimtalkPreview.data.sendable ||
    alimtalkMissing.length > 0 ||
    alimtalkTemplateUnapproved;
  const showAlimtalkNightNotice = isNightTimeKSTClient();
  const currentAlimtalkSend = alimtalkTarget
    ? localAlimtalkSendMap[alimtalkTarget.id]
    : undefined;

  return (
    <div className="space-y-2">
      {/* Header — 네이비 밴드. 이 화면의 주 액션이 여기 모여 있다. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-nk-navy-strong px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: "rgb(var(--wr-navy-ink) / 0.14)", boxShadow: "inset 0 0 0 1px rgb(var(--wr-navy-ink) / 0.18)" }}
          >
            <LayoutGrid className="h-5 w-5 text-nk-navy-ink" />
          </div>
          <div>
            <span className="block text-lg font-black tracking-tight text-nk-navy-ink">상담 현황</span>
            <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-nk-navy-ink/55">
              <Calendar className="h-3.5 w-3.5" />
              {formatHeaderDate()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-nk-ink-hint" />
            <input
              type="text"
              placeholder="이름, 학교, 연락처 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-52 rounded-lg border border-nk-surface/20 bg-nk-surface pl-9 pr-3 text-sm text-nk-ink placeholder-nk-ink-hint shadow-sm focus:outline-none focus:ring-2 focus:ring-nk-navy/40"
            />
          </div>
          <button
            onClick={() => startTransition(() => router.refresh())}
            className="rounded-lg p-2 text-nk-navy-ink/60 transition-colors hover:bg-nk-surface/10 hover:text-nk-navy-ink"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowTextParse(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-nk-navy-ink transition-all hover:-translate-y-px"
            style={{ background: "rgb(var(--wr-navy-ink) / 0.12)", boxShadow: "inset 0 0 0 1px rgb(var(--wr-navy-ink) / 0.2)" }}
          >
            <FileText className="h-4 w-4" />
            텍스트 등록
          </button>
          <button
            onClick={() => {
              setEditingConsultation(undefined);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-nk-surface px-4 py-2 text-sm font-bold text-nk-navy transition-colors hover:bg-nk-sunken"
          >
            <Plus className="h-4 w-4" />
            일정 추가
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        {/* 월별 필터 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <CalendarDays className="h-3.5 w-3.5 text-nk-ink-hint mr-0.5" />
          <button
            onClick={() => setMonthFilter(null)}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${
              monthFilter === null ? "border-transparent bg-nk-navy text-nk-navy-ink" : "bg-nk-surface text-nk-ink-sub border-nk-line-soft hover:bg-nk-sunken"
            }`}
          >
            전체
          </button>
          {availableMonths.map((ym) => (
            <button
              key={ym}
              onClick={() => setMonthFilter(monthFilter === ym ? null : ym)}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${
                monthFilter === ym ? "border-transparent bg-nk-navy text-nk-navy-ink" : "bg-nk-surface text-nk-ink-sub border-nk-line-soft hover:bg-nk-sunken"
              }`}
            >
              {formatYearMonth(ym)}
            </button>
          ))}
        </div>
        {/* 등록상태 필터 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-nk-ink-hint mr-0.5" />
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setStatusFilter(statusFilter === opt.value ? null : opt.value)}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${
                statusFilter === opt.value ? opt.activeCls : opt.cls + " hover:opacity-80"
              }`}
            >
              {opt.label}
              {statusFilter === opt.value && opt.value !== null && (
                <span className="ml-1 text-[10px] opacity-80">
                  {preFiltered.length}
                </span>
              )}
            </button>
          ))}
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
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-nk-progress-soft text-nk-progress tracking-wide">
                  TODAY
                </span>
              )}
              <span className="text-sm font-bold text-nk-ink">
                {formatGroupDate(date)}
              </span>
              <span className="text-xs text-nk-ink-hint bg-nk-sunken px-1.5 py-0.5 rounded font-medium">
                {items.length}건
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed" style={{ minWidth: "1014px" }}>
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
                      const isCancelled = item.status === "cancelled";
                      const cellStrike = isUnregistered || isCancelled ? "line-through" : "";
                      const vBorder = "border-r border-nk-line-soft";
                      const vBorderDark = "border-r border-nk-line";
                      const vb = isUnregistered ? vBorderDark : vBorder;
                      const hasParentSeparate = !!(item.parent_consult_date || item.parent_consult_time || item.parent_location);
                      const alimtalkSend = localAlimtalkSendMap[item.id];
                      const alimtalkTitle = getAlimtalkButtonTitle(alimtalkSend);

                      return (
                        <Fragment key={item.id}>
                        <tr
                          className={`border-t border-nk-line-soft transition-colors ${rowStyleByResult(item.result_status)} ${!isUnregistered ? "hover:bg-nk-sunken/80" : ""} ${isCancelled ? "opacity-50" : ""}`}
                        >
                          <td className={`py-2 px-1.5 font-semibold whitespace-nowrap ${cellStrike} ${vb} ${isUnregistered ? "text-nk-ink-sub" : "text-nk-ink"}`}>
                            {item.consult_time?.slice(0, 5) || "-"}
                          </td>
                          <td className={`py-2 px-1.5 font-bold whitespace-nowrap ${cellStrike} ${vb} ${isUnregistered ? "text-nk-ink-hint" : "text-nk-ink"}`}>
                            {item.name}
                            {isCancelled && (
                              <span className="ml-1 rounded bg-nk-line px-1.5 py-0.5 text-[9px] font-bold text-nk-ink-sub">
                                취소됨
                              </span>
                            )}
                            {!isCancelled && item.rescheduled_at && (
                              <span className="ml-1 rounded bg-nk-warn-soft px-1.5 py-0.5 text-[9px] font-bold text-nk-warn">
                                시간변경
                              </span>
                            )}
                          </td>
                          <td className={`py-2 px-1.5 text-xs whitespace-nowrap truncate ${cellStrike} ${vb} ${isUnregistered ? "text-nk-ink-sub" : "text-nk-ink-sub"}`}>
                            {[item.school, item.grade].filter(Boolean).join(" ") || "-"}
                          </td>
                          <td className={`py-2 px-1.5 whitespace-nowrap ${cellStrike} ${vb}`}>
                            {isUnregistered ? (
                              <span className="text-nk-ink-sub text-xs">{subj.text}</span>
                            ) : subj.cls ? (
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${subj.cls}`}>
                                {subj.text}
                              </span>
                            ) : (
                              <span className="text-nk-ink-hint text-xs">-</span>
                            )}
                          </td>
                          <td className={`py-2 px-1.5 whitespace-nowrap ${cellStrike} ${vb}`}>
                            {isUnregistered ? (
                              <span className="text-nk-ink-sub text-xs">{loc.text}</span>
                            ) : loc.cls ? (
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${loc.cls}`}>
                                {loc.text}
                              </span>
                            ) : (
                              <span className="text-nk-ink-hint text-xs">-</span>
                            )}
                          </td>
                          <td className={`py-2 px-1.5 whitespace-nowrap ${cellStrike} ${vb}`}>
                            {isUnregistered ? (
                              <span className="text-nk-ink-sub text-xs">{method.text}</span>
                            ) : method.isInPerson ? (
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold border border-nk-warn bg-nk-warn-soft text-nk-warn">
                                {method.text}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-nk-progress">
                                {method.text}
                              </span>
                            )}
                          </td>
                          <td className={`py-2 px-1.5 text-xs font-mono whitespace-nowrap truncate ${cellStrike} ${vb} ${isUnregistered ? "text-nk-ink-sub" : "text-nk-ink-sub"}`}>
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
                                      ? "text-nk-ink-sub"
                                      : value
                                        ? "text-nk-done font-semibold"
                                        : "text-nk-ink-hint hover:text-nk-ink-sub"
                                  }`}
                                >
                                  {value ? (
                                    <Check className={`h-3 w-3 ${isUnregistered ? "text-nk-ink-sub" : "text-nk-done"}`} />
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
                              <span className="text-nk-ink-sub text-xs">-</span>
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
                                      ? "bg-nk-done-soft text-nk-done"
                                      : "text-nk-ink-hint hover:bg-nk-sunken"
                                  }`}
                                >
                                  {item.test_fee_paid ? "납부" : "미납"}
                                </button>
                                {item.test_fee_paid && (
                                  <button
                                    onClick={() => {
                                      const next =
                                        item.test_fee_method === "transfer" ? "card" :
                                        item.test_fee_method === "card" ? "exempt" :
                                        "transfer";
                                      setLocalData((prev) =>
                                        prev.map((c) => c.id === item.id ? { ...c, test_fee_method: next } : c)
                                      );
                                      startTransition(async () => {
                                        await updateConsultationField(item.id, "test_fee_method", next);
                                      });
                                    }}
                                    className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                                      item.test_fee_method === "card"
                                        ? "bg-nk-progress-soft text-nk-progress"
                                        : item.test_fee_method === "exempt"
                                          ? "bg-nk-line text-nk-ink"
                                          : "bg-nk-warn-soft text-nk-warn"
                                    }`}
                                  >
                                    {item.test_fee_method === "card"
                                      ? "카드"
                                      : item.test_fee_method === "exempt"
                                        ? "면제"
                                        : "입금"}
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
                                    ? "bg-nk-late text-nk-navy-ink"
                                    : isUnregistered
                                      ? "text-nk-ink-sub hover:bg-nk-navy-strong"
                                      : "text-nk-ink-hint hover:bg-nk-sunken"
                                }`}
                              >
                                등록
                              </button>
                              <button
                                onClick={() => handleResultChange(item.id, "hold")}
                                className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                                  item.result_status === "hold"
                                    ? "bg-nk-warn text-nk-navy-ink"
                                    : isUnregistered
                                      ? "text-nk-ink-sub hover:bg-nk-navy-strong"
                                      : "text-nk-ink-hint hover:bg-nk-sunken"
                                }`}
                              >
                                고민
                              </button>
                              <button
                                onClick={() => handleResultChange(item.id, "other")}
                                className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                                  item.result_status === "other"
                                    ? "bg-nk-ink-sub text-nk-navy-ink line-through"
                                    : "text-nk-ink-hint hover:bg-nk-sunken"
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
                                      ? item.notify_sent ? "bg-nk-ink-sub text-nk-ink-hint" : "bg-nk-navy-strong text-nk-ink-sub border border-nk-line"
                                      : item.notify_sent
                                        ? "bg-nk-done-soft text-nk-done"
                                        : "bg-nk-done-soft text-nk-done border border-nk-done"
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
                            <div className="flex items-center gap-1">
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => handleCopy(item)}
                                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${isUnregistered ? "text-nk-ink-sub hover:bg-nk-navy-strong" : "text-nk-ink-hint hover:bg-nk-sunken hover:text-nk-ink-sub"}`}
                                  title="클립보드 복사"
                                >
                                  <ClipboardCopy className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleOpenAlimtalk(item)}
                                  className={`inline-flex h-7 items-center gap-0.5 rounded-md px-1.5 text-[10px] font-bold transition-colors ${
                                    alimtalkSend?.status === "failed"
                                      ? "bg-nk-late-soft text-nk-late hover:bg-nk-late-soft hover:text-nk-late"
                                      : alimtalkSend
                                        ? "bg-nk-warn-soft text-nk-warn hover:bg-nk-warn-soft"
                                        : isUnregistered
                                          ? "text-nk-ink-sub hover:bg-nk-navy-strong"
                                          : "text-nk-warn hover:bg-nk-warn-soft hover:text-nk-warn"
                                  }`}
                                  title={alimtalkTitle}
                                  aria-label={alimtalkTitle}
                                >
                                  {alimtalkSend?.status === "failed" ? (
                                    <XCircle className="h-3.5 w-3.5" />
                                  ) : alimtalkSend ? (
                                    <Check className="h-3.5 w-3.5" />
                                  ) : (
                                    <MessageCircle className="h-3.5 w-3.5" />
                                  )}
                                  톡
                                </button>
                                <button
                                  onClick={() => handleCreateDripLink(item)}
                                  className={`inline-flex h-7 items-center gap-0.5 rounded-md px-1.5 text-[10px] font-bold transition-colors ${
                                    isUnregistered
                                      ? "text-nk-ink-sub hover:bg-nk-navy-strong"
                                      : "text-nk-progress hover:bg-nk-progress-soft hover:text-nk-progress"
                                  }`}
                                  title="1주 설문 링크"
                                  aria-label="1주 설문 링크"
                                >
                                  <Link2 className="h-3.5 w-3.5" />
                                  W1
                                </button>
                              </div>

                              <span aria-hidden className="mx-0.5 h-4 border-l border-nk-line-soft" />

                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => handleEdit(item)}
                                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${isUnregistered ? "text-nk-ink-sub hover:bg-nk-navy-strong" : "text-nk-ink-hint hover:bg-nk-sunken hover:text-nk-ink-sub"}`}
                                  title="수정"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                {!isCancelled && (
                                  <button
                                    onClick={() => {
                                      setCancelTarget(item);
                                      setCancelReason("");
                                    }}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-nk-ink-hint transition-colors hover:bg-nk-sunken hover:text-nk-ink"
                                    title="취소"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDelete(item.id, item.name)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-nk-late transition-colors hover:bg-nk-late-soft hover:text-nk-late"
                                  title="완전삭제"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {hasParentSeparate && (
                          <tr className={`border-t border-dashed border-nk-warn ${rowStyleByResult(item.result_status) || "bg-nk-warn-soft/40"}`}>
                            <td colSpan={11} className="py-1.5 px-2">
                              <div className="flex items-center gap-2 text-[11px]">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-nk-warn-soft text-nk-warn font-semibold shrink-0">
                                  학부모 별도
                                </span>
                                {item.parent_consult_date && (
                                  <span className="text-nk-ink-sub">
                                    <span className="text-nk-ink-hint mr-0.5">날짜</span>
                                    {(() => {
                                      const d = new Date(item.parent_consult_date + "T00:00:00");
                                      return `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
                                    })()}
                                  </span>
                                )}
                                {item.parent_consult_time && (
                                  <span className="text-nk-ink-sub">
                                    <span className="text-nk-ink-hint mr-0.5">시간</span>
                                    {item.parent_consult_time.slice(0, 5)}
                                  </span>
                                )}
                                {item.parent_location && (
                                  <span className="text-nk-ink-sub">
                                    <span className="text-nk-ink-hint mr-0.5">장소</span>
                                    {item.parent_location}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {sortedDates.length === 0 && (
        <div className="text-center py-20 text-nk-ink-hint">
          <LayoutGrid className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-semibold mb-1">등록된 상담이 없습니다</p>
          <p className="text-sm">텍스트 등록 또는 일정 추가로 상담을 등록해보세요</p>
        </div>
      )}

      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCancelTarget(null);
            setCancelReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>상담 취소</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-nk-ink-sub">
            상담을 취소 상태로 변경하고 예약과 변경 이력을 함께 보존합니다.
          </p>
          <Input
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="취소 사유(선택)"
          />
          <DialogFooter>
            <button
              type="button"
              onClick={() => setCancelTarget(null)}
              className="rounded-lg border border-nk-line-soft px-4 py-2 text-sm font-semibold text-nk-ink-sub"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="rounded-lg bg-nk-navy-strong px-4 py-2 text-sm font-bold text-nk-navy-ink disabled:opacity-50"
            >
              {isPending ? "취소 처리 중..." : "상담 취소"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      <Dialog open={!!alimtalkTarget} onOpenChange={handleCloseAlimtalk}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>알림톡 발송 미리보기</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {currentAlimtalkSend && (
              <div className="rounded-lg border border-nk-warn bg-nk-warn-soft px-3 py-2 text-sm font-semibold text-nk-warn">
                이 상담에는 {formatAlimtalkSendAt(currentAlimtalkSend.sendAt)}에
                발송한 이력이 있습니다
              </div>
            )}
            <div className="rounded-lg border border-nk-line-soft bg-nk-sunken px-3 py-2 text-sm text-nk-ink-sub">
              대상:{" "}
              <span className="font-semibold text-nk-ink">
                {alimtalkTarget?.name ?? "-"} ·{" "}
                {alimtalkPreview.data?.maskedPhone ?? "-"} · 1명
              </span>
            </div>

            {alimtalkPreview.loading ? (
              <div className="rounded-lg border border-nk-line-soft bg-nk-surface p-5 text-center text-sm text-nk-ink-sub">
                미리보기를 불러오는 중입니다.
              </div>
            ) : alimtalkPreview.error ? (
              <div className="rounded-lg border border-nk-late bg-nk-late-soft px-3 py-2 text-sm font-semibold text-nk-late">
                {alimtalkPreview.error}
              </div>
            ) : (
              <div className="rounded-lg bg-nk-kakao p-4 text-sm leading-6 text-nk-ink shadow-sm">
                <div className="whitespace-pre-wrap">
                  {alimtalkPreview.data?.text ?? ""}
                </div>
              </div>
            )}

            {alimtalkMissing.length > 0 && (
              <div className="rounded-lg border border-nk-late bg-nk-late-soft px-3 py-2 text-sm font-semibold text-nk-late">
                미치환 변수: {alimtalkMissing.join(", ")}
              </div>
            )}

            {alimtalkTemplateUnapproved && (
              <div className="rounded-lg border border-nk-late bg-nk-late-soft px-3 py-2 text-sm font-semibold text-nk-late">
                미승인 템플릿
              </div>
            )}

            {alimtalkPreview.data &&
              !alimtalkPreview.data.sendable &&
              alimtalkMissing.length === 0 &&
              !alimtalkTemplateUnapproved && (
                <div className="rounded-lg border border-nk-late bg-nk-late-soft px-3 py-2 text-sm font-semibold text-nk-late">
                  대상 전화번호를 확인해 주세요
                </div>
              )}

            {showAlimtalkNightNotice && (
              <div className="rounded-lg border border-nk-warn bg-nk-warn-soft px-3 py-2 text-sm font-semibold text-nk-warn">
                야간 시간대 — 서버에서 발송이 차단될 수 있습니다
              </div>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => handleCloseAlimtalk(false)}
              disabled={sendingAlimtalk}
              className="rounded-lg border border-nk-line-soft bg-nk-surface px-4 py-2 text-sm font-semibold text-nk-ink-sub transition-colors hover:bg-nk-sunken disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSendAlimtalk}
              disabled={alimtalkSendDisabled}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-nk-navy-strong px-4 py-2 text-sm font-bold text-nk-navy-ink transition-colors hover:bg-nk-navy-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sendingAlimtalk ? "발송 중" : "발송하기"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
