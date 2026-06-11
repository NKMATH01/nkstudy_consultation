"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { BookOpenCheck, Lock, Save, Pencil, AlertTriangle, Users, Plus, Trash2, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { progressFormSchema, type ProgressFormValues } from "@/lib/validations/progress";
import { addTextbookHistory, deleteTextbookHistory, updateCurrentPage, upsertProgress } from "@/lib/actions/progress";
import { GRADES, CLASS_LEVELS, CLASS_PACES, type TextbookHistory } from "@/types";
import type { ProgressBoardRow, ProgressTeacherInfo } from "@/lib/actions/progress";

interface Props {
  initialRows: ProgressBoardRow[];
  currentTeacher: ProgressTeacherInfo | null;
  initialError?: string | null;
}

const FULL_ACCESS_ROLES = new Set(["admin", "director", "principal", "manager", "staff"]);
const LIMITED_ROLES = new Set(["teacher", "clinic"]);

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function progressPercent(current: number | null | undefined, total: number | null | undefined) {
  if (!current || !total || total <= 0) return null;
  return Math.min(100, Math.round((current / total) * 100));
}

function canEditRow(row: ProgressBoardRow, teacher: ProgressTeacherInfo | null): boolean {
  if (!teacher?.role) return false;
  if (FULL_ACCESS_ROLES.has(teacher.role)) return true;
  if (LIMITED_ROLES.has(teacher.role)) return Boolean(teacher.id && row.teacher_id === teacher.id);
  return false;
}

function rowWithProgress(
  row: ProgressBoardRow,
  result: {
    progress?: ProgressBoardRow["progress"];
    recent_logs?: ProgressBoardRow["recent_logs"];
    weekly_progress?: ProgressBoardRow["weekly_progress"];
  }
): ProgressBoardRow {
  const progress = result.progress ?? row.progress;
  return {
    ...row,
    progress,
    student_count: row.actual_student_count,
    recent_logs: result.recent_logs ?? row.recent_logs,
    weekly_progress: result.weekly_progress ?? row.weekly_progress,
  };
}

function numberValue(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function defaultValues(row: ProgressBoardRow): ProgressFormValues {
  const progress = row.progress;
  return {
    main_textbook: progress?.main_textbook ?? "",
    main_total_pages: progress?.main_total_pages ?? undefined,
    current_page: progress?.current_page ?? undefined,
    sub_textbook: progress?.sub_textbook ?? "",
    next_textbook: progress?.next_textbook ?? "",
    next_start_date: progress?.next_start_date ?? "",
    expected_months: progress?.expected_months ?? undefined,
    expected_weeks: progress?.expected_weeks ?? undefined,
    current_plan: progress?.current_plan ?? "",
    note: progress?.note ?? "",
    ability_level: (progress?.ability_level as ProgressFormValues["ability_level"]) ?? undefined,
    study_intensity: (progress?.study_intensity as ProgressFormValues["study_intensity"]) ?? undefined,
    homework_volume: (progress?.homework_volume as ProgressFormValues["homework_volume"]) ?? undefined,
    class_pace: (progress?.class_pace as ProgressFormValues["class_pace"]) ?? undefined,
  };
}

/** "3개월 2주" 형식의 예상 기간 문자열 */
function formatExpectedDuration(months: number | null | undefined, weeks: number | null | undefined): string | null {
  const parts: string[] = [];
  if (months != null && months > 0) parts.push(`${months}개월`);
  if (weeks != null && weeks > 0) parts.push(`${weeks}주`);
  return parts.length > 0 ? parts.join(" ") : null;
}

/** 가장 최근 목요일 00:00 (오늘이 목요일이면 오늘) — 주간 업데이트 사이클 기준 */
function lastThursday(): Date {
  const now = new Date();
  const diff = (now.getDay() - 4 + 7) % 7;
  const thu = new Date(now);
  thu.setDate(now.getDate() - diff);
  thu.setHours(0, 0, 0, 0);
  return thu;
}

const TRAIT_LABELS: Array<{ key: "ability_level" | "study_intensity" | "homework_volume" | "class_pace"; label: string }> = [
  { key: "ability_level", label: "능력" },
  { key: "study_intensity", label: "강도" },
  { key: "homework_volume", label: "숙제량" },
  { key: "class_pace", label: "속도" },
];

const TRAIT_COLORS: Record<string, { bg: string; color: string }> = {
  ability_level: { bg: "color-mix(in srgb, var(--accent-warm) 28%, white)", color: "var(--accent-warm-foreground)" },
  study_intensity: { bg: "color-mix(in srgb, var(--primary) 10%, white)", color: "var(--primary)" },
  homework_volume: { bg: "#CCFBF1", color: "#0F766E" },
  class_pace: { bg: "#EDE9FE", color: "#6D28D9" },
};

function TraitBadges({ progress }: { progress: ProgressBoardRow["progress"] }) {
  if (!progress) return null;
  const badges = TRAIT_LABELS.filter(({ key }) => progress[key]);
  if (badges.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {badges.map(({ key, label }) => (
        <span
          key={key}
          className="inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-extrabold"
          style={TRAIT_COLORS[key]}
        >
          {label} {progress[key]}
        </span>
      ))}
    </div>
  );
}

function gradeFromClassName(className: string): string {
  const match = className.trimStart().match(/^(초|중|고)\s*([1-6])/);
  if (!match) return "고3";

  const school = match[1];
  const grade = match[2];
  return school && grade ? `${school}${grade}` : "고3";
}

function SectionHeader({ grade, count }: { grade: string; count: number }) {
  return (
    <div
      className="flex items-center justify-between rounded-t-2xl px-5 py-3.5"
      style={{
        background:
          "radial-gradient(circle at 12% 0%, rgba(233,196,106,0.18), transparent 38%), linear-gradient(135deg, var(--primary) 0%, var(--primary-soft) 100%)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: "rgba(255,255,255,0.14)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)" }}
        >
          <BookOpenCheck className="h-4 w-4 text-white" />
        </span>
        <h2 className="text-[15px] font-black tracking-tight text-white">{grade}</h2>
      </div>
      <span
        className="rounded-full px-2.5 py-1 text-[11px] font-black"
        style={{ background: "rgba(233,196,106,0.22)", color: "#F8E7BD", boxShadow: "inset 0 0 0 1px rgba(233,196,106,0.28)" }}
      >
        {count}개 반
      </span>
    </div>
  );
}

/** 진도율 구간별 색상: 초반(로즈) → 중반(골드) → 마무리(에메랄드) */
function meterColors(percent: number): { bar: string; text: string } {
  if (percent >= 80) return { bar: "linear-gradient(90deg, #34D399, #059669)", text: "#047857" };
  if (percent >= 40) return { bar: "linear-gradient(90deg, var(--accent-warm), var(--chart-4))", text: "var(--accent-warm-foreground)" };
  return { bar: "linear-gradient(90deg, #FDA4AF, #F43F5E)", text: "#BE123C" };
}

function ProgressMeter({ current, total }: { current: number | null | undefined; total: number | null | undefined }) {
  const percent = progressPercent(current, total);
  if (percent == null) {
    return <span className="text-xs text-slate-400">페이지 미입력</span>;
  }
  const colors = meterColors(percent);

  return (
    <div className="flex min-w-[200px] items-center gap-2.5">
      <div className="flex-1 space-y-1">
        <div className="text-[11px] font-bold text-slate-500">
          {current}p <span className="font-medium text-slate-400">/ {total}p</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "#EEF1F6", boxShadow: "inset 0 1px 2px rgba(15,23,42,0.06)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${percent}%`, background: colors.bar }}
          />
        </div>
      </div>
      <span className="shrink-0 text-base font-black tabular-nums" style={{ color: colors.text }}>
        {percent}%
      </span>
    </div>
  );
}

function ProgressDialog({
  row,
  open,
  onClose,
  onSaved,
  onHistoryChange,
}: {
  row: ProgressBoardRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: (row: ProgressBoardRow) => void;
  onHistoryChange: (classId: string, history: TextbookHistory[]) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [history, setHistory] = useState<TextbookHistory[]>(row?.textbook_history ?? []);
  const [newTextbook, setNewTextbook] = useState("");
  const [historyPending, setHistoryPending] = useState(false);
  const form = useForm<ProgressFormValues>({
    resolver: zodResolver(progressFormSchema) as never,
    defaultValues: row ? defaultValues(row) : {},
  });

  if (!row) return null;

  /** 지난 교재 추가. 갱신된 이력 배열을 반환해 onSubmit에서 stale state 없이 사용 */
  const handleAddHistory = async (): Promise<TextbookHistory[]> => {
    if (!newTextbook.trim()) {
      toast.error("지난 교재명을 입력해주세요");
      return history;
    }
    setHistoryPending(true);
    const result = await addTextbookHistory(row.class_id, { textbook: newTextbook });
    setHistoryPending(false);
    if (result.success && result.history) {
      const next = [result.history, ...history];
      setHistory(next);
      onHistoryChange(row.class_id, next);
      setNewTextbook("");
      toast.success("지난 교재가 추가되었습니다");
      return next;
    }
    toast.error(("error" in result && result.error) || "교재 이력 추가 실패");
    return history;
  };

  const handleDeleteHistory = async (historyId: string) => {
    setHistoryPending(true);
    const result = await deleteTextbookHistory(historyId);
    setHistoryPending(false);
    if (result.success) {
      const next = history.filter((h) => h.id !== historyId);
      setHistory(next);
      onHistoryChange(row.class_id, next);
    } else {
      toast.error(result.error || "교재 이력 삭제 실패");
    }
  };

  const numberRegister = {
    setValueAs: (value: string) => (value === "" ? undefined : Number(value)),
  };

  const onSubmit = (values: ProgressFormValues) => {
    startTransition(async () => {
      // 지난 교재 입력칸에 [추가]를 누르지 않은 텍스트가 남아 있으면 자동으로 함께 저장
      let latestHistory = history;
      if (newTextbook.trim()) {
        latestHistory = await handleAddHistory();
      }
      const result = await upsertProgress(row.class_id, values);
      if (result.success) {
        toast.success("진도 정보가 저장되었습니다");
        // 주의: row prop은 다이얼로그 오픈 시점 스냅샷 — 이력은 최신 상태로 덮어써야
        // [추가]한 교재가 저장 직후 사라지는 버그가 없음
        onSaved(rowWithProgress({ ...row, textbook_history: latestHistory }, result));
        onClose();
        router.refresh();
      } else {
        toast.error(result.error || "진도 저장 실패");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-[720px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row.class_name} 진도 입력</DialogTitle>
          <DialogDescription>교재, 페이지, 진행 계획을 한 번에 관리합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* 반 특성 — 신입생 배정 판단 기준 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="mb-2 text-xs font-extrabold text-slate-600">반 특성 (배정 기준)</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-500">학습능력</span>
                <select
                  {...form.register("ability_level")}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold"
                >
                  <option value="">선택</option>
                  {CLASS_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-500">학습강도</span>
                <select
                  {...form.register("study_intensity")}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold"
                >
                  <option value="">선택</option>
                  {CLASS_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-500">학습량(숙제)</span>
                <select
                  {...form.register("homework_volume")}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold"
                >
                  <option value="">선택</option>
                  {CLASS_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-500">진도속도</span>
                <select
                  {...form.register("class_pace")}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold"
                >
                  <option value="">선택</option>
                  {CLASS_PACES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-500">메인교재</span>
            <Input {...form.register("main_textbook")} />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-500">전체 페이지</span>
              <Input type="number" inputMode="numeric" {...form.register("main_total_pages", numberRegister)} />
              {form.formState.errors.main_total_pages && (
                <span className="text-[11px] font-semibold text-red-500">{form.formState.errors.main_total_pages.message}</span>
              )}
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-500">현재 페이지</span>
              <Input type="number" inputMode="numeric" {...form.register("current_page", numberRegister)} />
              {form.formState.errors.current_page && (
                <span className="text-[11px] font-semibold text-red-500">{form.formState.errors.current_page.message}</span>
              )}
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-500">부교재</span>
              <Input {...form.register("sub_textbook")} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-500">예정교재</span>
              <Input {...form.register("next_textbook")} />
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-500">다음 교재 시작 예정일</span>
              <Input type="date" {...form.register("next_start_date")} className="w-fit" />
            </label>
            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-slate-500">현재 교재 예상 기간</span>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  {...form.register("expected_months", numberRegister)}
                  className="h-9 w-16 text-center font-bold"
                />
                <span className="text-sm font-semibold text-slate-500">개월</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  {...form.register("expected_weeks", numberRegister)}
                  className="h-9 w-16 text-center font-bold"
                />
                <span className="text-sm font-semibold text-slate-500">주</span>
              </div>
              {(form.formState.errors.expected_months || form.formState.errors.expected_weeks) && (
                <span className="text-[11px] font-semibold text-red-500">
                  {form.formState.errors.expected_months?.message || form.formState.errors.expected_weeks?.message}
                </span>
              )}
            </div>
          </div>

          {/* 지난 교재 이력 — 계속 누적 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-slate-600">
              <History className="h-3.5 w-3.5" />
              지난 교재 ({history.length})
            </p>
            {history.length > 0 && (
              <ul className="mb-3 flex flex-wrap gap-1.5">
                {history.map((h) => (
                  <li
                    key={h.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1"
                  >
                    <span className="text-sm font-semibold text-slate-700">{h.textbook}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteHistory(h.id)}
                      disabled={historyPending}
                      className="rounded p-0.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                      title="이력 삭제"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-end gap-2">
              <label className="flex-1 space-y-1">
                <span className="text-[11px] font-bold text-slate-500">교재명</span>
                <Input
                  value={newTextbook}
                  onChange={(e) => setNewTextbook(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddHistory();
                    }
                  }}
                  placeholder="예: 쎈 수학(상)"
                  className="h-9"
                />
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={historyPending}
                onClick={handleAddHistory}
                className="h-9 gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                추가
              </Button>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-500">진행 계획</span>
            <Textarea rows={3} {...form.register("current_plan")} />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-500">비고</span>
            <Textarea rows={3} {...form.register("note")} />
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClassDetailDialog({
  row,
  onClose,
  onEdit,
  editable,
}: {
  row: ProgressBoardRow | null;
  onClose: () => void;
  onEdit: (row: ProgressBoardRow) => void;
  editable: boolean;
}) {
  if (!row) return null;
  const progress = row.progress;
  const percent = progressPercent(progress?.current_page, progress?.main_total_pages);

  const infoRow = (label: string, value: string | null | undefined) => (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 font-bold text-slate-400">{label}</span>
      <span className="font-semibold text-slate-700">{value || "-"}</span>
    </div>
  );

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-[640px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpenCheck className="h-4.5 w-4.5" style={{ color: "var(--primary)" }} />
            {row.class_name} 상세 정보
          </DialogTitle>
          <DialogDescription>
            {row.teacher_name || "담당 미정"} · 재원 {row.actual_student_count}명
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 반 특성 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="mb-2 text-xs font-extrabold text-slate-600">반 특성</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TRAIT_LABELS.map(({ key, label }) => (
                <div key={key} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center">
                  <p className="text-[10px] font-bold text-slate-400">{label}</p>
                  <p className="text-sm font-black" style={{ color: "var(--primary)" }}>
                    {progress?.[key] || "-"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 교재·진도 */}
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-extrabold text-slate-600">교재 · 진도</p>
            {infoRow("메인교재", progress?.main_textbook)}
            {percent != null && (
              <div className="flex gap-2">
                <span className="w-28 shrink-0 text-sm font-bold text-slate-400">진도율</span>
                <div className="flex-1">
                  <ProgressMeter current={progress?.current_page} total={progress?.main_total_pages} />
                </div>
              </div>
            )}
            {infoRow("예상 기간", formatExpectedDuration(progress?.expected_months, progress?.expected_weeks))}
            {infoRow("부교재", progress?.sub_textbook)}
            {infoRow("예정교재", progress?.next_textbook)}
            {infoRow("다음 시작 예정", progress?.next_start_date)}
            {infoRow("진행 계획", progress?.current_plan)}
            {infoRow("비고", progress?.note)}
            {infoRow(
              "최신화",
              progress?.progress_updated_at
                ? `${formatDate(progress.progress_updated_at)}${progress.updated_by ? ` (${progress.updated_by})` : ""}`
                : null
            )}
          </div>

          {/* 지난 교재 이력 */}
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-slate-600">
              <History className="h-3.5 w-3.5" />
              지난 교재 ({row.textbook_history.length})
            </p>
            {row.textbook_history.length === 0 ? (
              <p className="text-xs text-slate-400">기록된 지난 교재가 없습니다</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {row.textbook_history.map((h) => (
                  <li key={h.id} className="rounded-lg bg-slate-50 px-2.5 py-1 text-sm font-semibold text-slate-700">
                    {h.textbook}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 학생 명단 */}
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-slate-600">
              <Users className="h-3.5 w-3.5" />
              학생 명단 ({row.student_names.length})
            </p>
            {row.student_names.length === 0 ? (
              <p className="text-xs text-slate-400">이 반으로 배정된 재원생이 없습니다</p>
            ) : (
              <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {row.student_names.map((name, idx) => (
                  <li
                    key={`${name}-${idx}`}
                    className="rounded-lg bg-slate-50 px-2 py-1 text-center text-sm font-semibold text-slate-700"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="outline" onClick={onClose}>닫기</Button>
            {editable && (
              <Button onClick={() => { onClose(); onEdit(row); }} className="gap-1">
                <Pencil className="h-3.5 w-3.5" />
                수정
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StudentListDialog({
  row,
  onClose,
}: {
  row: ProgressBoardRow | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(row)} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[80vh] max-w-[420px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {row?.class_name} 학생 명단
          </DialogTitle>
          <DialogDescription>
            재원생 {row?.student_names.length ?? 0}명 (학생 관리 기준)
          </DialogDescription>
        </DialogHeader>
        {row && row.student_names.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            이 반으로 배정된 재원생이 없습니다
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {row?.student_names.map((name, idx) => (
              <li
                key={`${name}-${idx}`}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-center text-sm font-semibold text-slate-700"
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ProgressBoardClient({ initialRows, currentTeacher, initialError }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<ProgressBoardRow[]>(initialRows);
  const [editingRow, setEditingRow] = useState<ProgressBoardRow | null>(null);
  const [studentListRow, setStudentListRow] = useState<ProgressBoardRow | null>(null);
  const [detailRow, setDetailRow] = useState<ProgressBoardRow | null>(null);
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);
  const [pageInputs, setPageInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialRows.map((row) => [row.class_id, numberValue(row.progress?.current_page)]))
  );
  const [pendingClassId, setPendingClassId] = useState<string | null>(null);

  useEffect(() => {
    if (initialError) toast.error(`진도현황 조회 실패: ${initialError}`);
  }, [initialError]);

  const grouped = useMemo(() => {
    const map = new Map<string, ProgressBoardRow[]>();
    for (const row of rows) {
      const grade = gradeFromClassName(row.class_name);
      map.set(grade, [...(map.get(grade) ?? []), row]);
    }

    const gradeOrder = new Map(GRADES.map((grade, index) => [grade, index]));
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        return (gradeOrder.get(a as (typeof GRADES)[number]) ?? 999) - (gradeOrder.get(b as (typeof GRADES)[number]) ?? 999);
      })
      .map(([grade, items]) => ({
        grade,
        items: items.slice().sort((a, b) => a.class_name.localeCompare(b.class_name, "ko")),
      }));
  }, [rows]);

  const updateRow = (nextRow: ProgressBoardRow) => {
    setRows((prev) => prev.map((row) => (row.class_id === nextRow.class_id ? nextRow : row)));
    setPageInputs((prev) => ({
      ...prev,
      [nextRow.class_id]: numberValue(nextRow.progress?.current_page),
    }));
  };

  const handlePageSave = async (row: ProgressBoardRow) => {
    const raw = pageInputs[row.class_id];
    const page = Number(raw);
    if (!raw || !Number.isInteger(page) || page <= 0) {
      toast.error("현재 페이지를 양의 정수로 입력해주세요");
      return;
    }

    setPendingClassId(row.class_id);
    const result = await updateCurrentPage(row.class_id, page);
    setPendingClassId(null);

    if (result.success) {
      const nextRow = rowWithProgress(row, result);
      updateRow(nextRow);
      toast.success("현재 페이지가 저장되었습니다");
      router.refresh();
    } else {
      toast.error(result.error || "현재 페이지 저장 실패");
    }
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm font-semibold text-slate-600">표시할 반이 없습니다</p>
        <p className="mt-1 text-xs text-slate-400">마이그레이션 미적용 또는 조회 오류가 있으면 빈 목록으로 표시됩니다.</p>
      </div>
    );
  }

  const visibleGroups = gradeFilter ? grouped.filter(({ grade }) => grade === gradeFilter) : grouped;

  // 주간(목요일 기준) 진도 입력 현황 — 강사별로 미입력 반이 있는지 집계
  const thursday = lastThursday();
  const isStale = (row: ProgressBoardRow) => {
    const updated = row.progress?.progress_updated_at;
    if (!updated) return true;
    const date = new Date(updated);
    return Number.isNaN(date.getTime()) || date < thursday;
  };
  const teacherStatus = new Map<string, { staleClasses: string[]; total: number }>();
  for (const row of rows) {
    const name = row.teacher_name || "담당 미정";
    const entry = teacherStatus.get(name) ?? { staleClasses: [], total: 0 };
    entry.total += 1;
    if (isStale(row)) entry.staleClasses.push(row.class_name);
    teacherStatus.set(name, entry);
  }
  const teacherChips = [...teacherStatus.entries()]
    .map(([name, s]) => ({ name, stale: s.staleClasses.length, total: s.total, staleClasses: s.staleClasses }))
    .sort((a, b) => b.stale - a.stale || a.name.localeCompare(b.name, "ko"));
  const staleTeacherCount = teacherChips.filter((t) => t.stale > 0).length;

  return (
    <div className="space-y-6">
      {/* 본인 식별 실패 안내 — 임시 계정 로그인 시 입력이 잠기는 문제 안내 */}
      {!currentTeacher && (
        <div
          className="flex items-start gap-2.5 rounded-2xl border px-4 py-3"
          style={{ background: "#FEF2F2", borderColor: "#FCA5A5" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div className="text-xs leading-relaxed text-red-700">
            <p className="font-extrabold">로그인 계정으로 선생님을 확인할 수 없어 입력이 잠겨 있습니다.</p>
            <p className="mt-0.5">
              임시 번호(010-0000-xxxx) 계정이 아닌 <b>본인 실제 전화번호</b>로 다시 로그인해주세요.
              (초기 비밀번호 1234 — 첫 로그인 시 변경 화면이 뜹니다)
            </p>
          </div>
        </div>
      )}

      {/* 주간 진도 입력 현황 — 강사별 (목요일 기준) */}
      {teacherChips.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-3"
          style={{ boxShadow: "0 1px 3px rgba(15,43,91,0.04), 0 4px 12px rgba(15,43,91,0.03)" }}
        >
          <span className="flex items-center gap-1.5 text-xs font-extrabold text-slate-600">
            {staleTeacherCount > 0 ? (
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            ) : (
              <BookOpenCheck className="h-4 w-4 text-emerald-500" />
            )}
            이번 주 진도 입력 (목요일 기준)
            {staleTeacherCount > 0 && (
              <span className="text-orange-600">— 미입력 {staleTeacherCount}명</span>
            )}
          </span>
          <div className="flex flex-wrap gap-1">
            {teacherChips.map((t) => {
              const incomplete = t.stale > 0;
              return (
                <span
                  key={t.name}
                  title={
                    incomplete
                      ? `미입력 반: ${t.staleClasses.join(", ")}`
                      : `담당 ${t.total}개 반 모두 입력 완료`
                  }
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                  style={
                    incomplete
                      ? { background: "#FEE2E2", color: "#B91C1C", boxShadow: "inset 0 0 0 1px #FCA5A5" }
                      : { background: "#ECFDF5", color: "#047857", boxShadow: "inset 0 0 0 1px #A7F3D0" }
                  }
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: incomplete ? "#EF4444" : "#10B981" }}
                  />
                  {t.name}
                  {incomplete && <span className="font-black">{t.stale}</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 학년별 필터 버튼 */}
      <div className="flex flex-wrap gap-1.5">
        {[{ grade: null as string | null, label: `전체 (${rows.length})` }, ...grouped.map(({ grade, items }) => ({ grade: grade as string | null, label: `${grade} (${items.length})` }))].map(({ grade, label }) => {
          const active = gradeFilter === grade;
          return (
            <button
              key={grade ?? "__all__"}
              type="button"
              onClick={() => setGradeFilter(active && grade !== null ? null : grade)}
              className="rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-all hover:-translate-y-px"
              style={
                active
                  ? {
                      background: "linear-gradient(135deg, var(--primary), var(--primary-soft))",
                      color: "#fff",
                      boxShadow: "0 6px 16px color-mix(in srgb, var(--primary) 28%, transparent), inset 0 0 0 1px rgba(233,196,106,0.35)",
                    }
                  : {
                      background: "#fff",
                      color: "var(--muted-foreground)",
                      boxShadow: "inset 0 0 0 1px var(--border), 0 1px 2px rgba(15,23,42,0.04)",
                    }
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {visibleGroups.map(({ grade, items }) => (
        <section key={grade} className="card-elevated overflow-hidden rounded-2xl">
          <SectionHeader grade={grade} count={items.length} />
          <div className="overflow-x-auto rounded-b-2xl border border-t-0 border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/90">
                  <TableHead className="min-w-[120px] px-4 text-xs font-bold text-slate-500">반명</TableHead>
                  <TableHead className="min-w-[80px] text-xs font-bold text-slate-500">강사명</TableHead>
                  <TableHead className="min-w-[68px] text-xs font-bold text-slate-500">인원</TableHead>
                  <TableHead className="min-w-[280px] text-xs font-bold text-slate-500">메인교재 · 진도율</TableHead>
                  <TableHead className="min-w-[160px] text-xs font-bold text-slate-500">현재 페이지</TableHead>
                  <TableHead className="min-w-[130px] text-xs font-bold text-slate-500">최신화</TableHead>
                  <TableHead className="min-w-[80px] text-xs font-bold text-slate-500">입력</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => {
                  const progress = row.progress;
                  const editable = canEditRow(row, currentTeacher);
                  const isSaving = pendingClassId === row.class_id;
                  return (
                    <TableRow
                      key={row.class_id}
                      className="transition-colors odd:bg-white even:bg-slate-50/45 hover:bg-[#F6F2E7]/60"
                    >
                      <TableCell className="px-4 font-bold text-slate-900">
                        <button
                          type="button"
                          onClick={() => setDetailRow(row)}
                          title="반 상세 정보 보기"
                          className="flex cursor-pointer items-center gap-2 text-left underline-offset-4 transition hover:underline"
                          style={{ color: "var(--primary)" }}
                        >
                          {!editable && <Lock className="h-3.5 w-3.5 text-slate-300" />}
                          {row.class_name}
                        </button>
                        <TraitBadges progress={progress} />
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-slate-600">{row.teacher_name || "-"}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setStudentListRow(row)}
                          title="학생 명단 보기"
                          className="inline-flex min-w-12 cursor-pointer items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
                        >
                          <Users className="h-3 w-3 text-slate-400" />
                          {row.student_count}명
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          <p className="max-w-[240px] whitespace-normal text-sm font-semibold text-slate-800">{progress?.main_textbook || "-"}</p>
                          <ProgressMeter current={progress?.current_page} total={progress?.main_total_pages} />
                          {(progress?.sub_textbook || progress?.next_textbook || progress?.next_start_date || formatExpectedDuration(progress?.expected_months, progress?.expected_weeks)) && (
                            <p className="max-w-[260px] whitespace-normal text-[11px] font-medium leading-relaxed text-slate-500">
                              {formatExpectedDuration(progress?.expected_months, progress?.expected_weeks) && (
                                <span className="font-bold" style={{ color: "var(--accent-warm-foreground)" }}>
                                  예상 {formatExpectedDuration(progress?.expected_months, progress?.expected_weeks)}
                                </span>
                              )}
                              {formatExpectedDuration(progress?.expected_months, progress?.expected_weeks) && (progress?.sub_textbook || progress?.next_textbook || progress?.next_start_date) && " · "}
                              {progress?.sub_textbook && <>부교재 {progress.sub_textbook}</>}
                              {progress?.sub_textbook && (progress?.next_textbook || progress?.next_start_date) && " · "}
                              {progress?.next_textbook && <>예정 {progress.next_textbook}</>}
                              {progress?.next_textbook && progress?.next_start_date && " "}
                              {progress?.next_start_date && <>({progress.next_start_date.slice(5).replace("-", "/")} 시작)</>}
                            </p>
                          )}
                          {progress?.current_plan && (
                            <p className="max-w-[240px] truncate text-[11px] text-slate-400" title={progress.current_plan}>
                              계획: {progress.current_plan}
                            </p>
                          )}
                          {row.textbook_history.length > 0 && (
                            <p
                              className="max-w-[240px] truncate text-[11px] font-medium text-slate-400"
                              title={row.textbook_history.map((h) => h.textbook).join(", ")}
                            >
                              지난 교재 {row.textbook_history.length}권 · {row.textbook_history[0].textbook}
                              {row.textbook_history.length > 1 && " 외"}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            value={pageInputs[row.class_id] ?? ""}
                            onChange={(e) => setPageInputs((prev) => ({ ...prev, [row.class_id]: e.target.value.replace(/\D/g, "") }))}
                            inputMode="numeric"
                            disabled={!editable || isSaving}
                            className="h-8 w-20 text-center text-sm font-bold"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!editable || isSaving}
                            onClick={() => handlePageSave(row)}
                            className="h-8 gap-1"
                          >
                            <Save className="h-3.5 w-3.5" />
                            저장
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-slate-600">{formatDate(progress?.progress_updated_at)}</p>
                          {progress?.updated_by && (
                            <p className="text-[11px] font-medium text-slate-400">{progress.updated_by}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          disabled={!editable}
                          onClick={() => setEditingRow(row)}
                          className="h-8 gap-1"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          입력
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      ))}

      <ProgressDialog
        key={editingRow?.class_id ?? "progress-dialog"}
        row={editingRow}
        open={Boolean(editingRow)}
        onClose={() => setEditingRow(null)}
        onSaved={updateRow}
        onHistoryChange={(classId, history) =>
          setRows((prev) => prev.map((r) => (r.class_id === classId ? { ...r, textbook_history: history } : r)))
        }
      />
      <StudentListDialog row={studentListRow} onClose={() => setStudentListRow(null)} />
      <ClassDetailDialog
        row={detailRow}
        onClose={() => setDetailRow(null)}
        onEdit={(row) => setEditingRow(row)}
        editable={detailRow ? canEditRow(detailRow, currentTeacher) : false}
      />
    </div>
  );
}
