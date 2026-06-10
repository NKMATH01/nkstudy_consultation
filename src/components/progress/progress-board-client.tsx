"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { BookOpenCheck, Lock, Save, Pencil, AlertTriangle } from "lucide-react";
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
import { updateCurrentPage, upsertProgress } from "@/lib/actions/progress";
import { GRADES } from "@/types";
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
    student_count: progress?.student_count ?? row.actual_student_count,
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
    student_count: progress?.student_count ?? undefined,
    main_textbook: progress?.main_textbook ?? "",
    main_total_pages: progress?.main_total_pages ?? undefined,
    current_page: progress?.current_page ?? undefined,
    sub_textbook: progress?.sub_textbook ?? "",
    next_textbook: progress?.next_textbook ?? "",
    next_start_plan: progress?.next_start_plan ?? "",
    current_plan: progress?.current_plan ?? "",
    note: progress?.note ?? "",
  };
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
    <div className="flex items-center justify-between rounded-t-2xl border border-b-0 border-slate-200 bg-white px-5 py-3">
      <div className="flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm"
          style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-soft))" }}
        >
          <BookOpenCheck className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-extrabold text-slate-900">{grade}</h2>
          <p className="text-[11px] font-semibold text-slate-400">{count}개 반</p>
        </div>
      </div>
    </div>
  );
}

function ProgressMeter({ current, total }: { current: number | null | undefined; total: number | null | undefined }) {
  const percent = progressPercent(current, total);
  if (percent == null) {
    return <span className="text-xs text-slate-400">페이지 미입력</span>;
  }

  return (
    <div className="min-w-[180px] space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-bold">
        <span className="text-slate-600">
          {current}p / {total}p
        </span>
        <span style={{ color: "var(--accent-warm-foreground)" }}>{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${percent}%`,
            background: "linear-gradient(90deg, var(--accent-warm), var(--chart-4))",
          }}
        />
      </div>
    </div>
  );
}

function ProgressDialog({
  row,
  open,
  onClose,
  onSaved,
}: {
  row: ProgressBoardRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: (row: ProgressBoardRow) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<ProgressFormValues>({
    resolver: zodResolver(progressFormSchema) as never,
    defaultValues: row ? defaultValues(row) : {},
  });

  if (!row) return null;

  const numberRegister = {
    setValueAs: (value: string) => (value === "" ? undefined : Number(value)),
  };

  const onSubmit = (values: ProgressFormValues) => {
    startTransition(async () => {
      const result = await upsertProgress(row.class_id, values);
      if (result.success) {
        toast.success("진도 정보가 저장되었습니다");
        onSaved(rowWithProgress(row, result));
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-500">인원</span>
              <Input type="number" inputMode="numeric" {...form.register("student_count", numberRegister)} />
              {form.formState.errors.student_count && (
                <span className="text-[11px] font-semibold text-red-500">{form.formState.errors.student_count.message}</span>
              )}
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-bold text-slate-500">메인교재</span>
              <Input {...form.register("main_textbook")} />
            </label>
          </div>

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

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-500">다음 교재 시작</span>
            <Input {...form.register("next_start_plan")} placeholder="예: 7월 2주차 / 시험 종료 후" />
          </label>

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

export function ProgressBoardClient({ initialRows, currentTeacher, initialError }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<ProgressBoardRow[]>(initialRows);
  const [editingRow, setEditingRow] = useState<ProgressBoardRow | null>(null);
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

  return (
    <div className="space-y-6">
      {grouped.map(({ grade, items }) => (
        <section key={grade} className="overflow-hidden rounded-2xl shadow-sm">
          <SectionHeader grade={grade} count={items.length} />
          <div className="border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/90">
                  <TableHead className="min-w-[130px] px-4 text-xs font-bold text-slate-500">반명</TableHead>
                  <TableHead className="min-w-[92px] text-xs font-bold text-slate-500">강사명</TableHead>
                  <TableHead className="min-w-[70px] text-xs font-bold text-slate-500">인원</TableHead>
                  <TableHead className="min-w-[240px] text-xs font-bold text-slate-500">메인교재</TableHead>
                  <TableHead className="min-w-[96px] text-xs font-bold text-slate-500">주간 진도</TableHead>
                  <TableHead className="min-w-[130px] text-xs font-bold text-slate-500">부교재</TableHead>
                  <TableHead className="min-w-[130px] text-xs font-bold text-slate-500">예정교재</TableHead>
                  <TableHead className="min-w-[150px] text-xs font-bold text-slate-500">다음 교재 시작</TableHead>
                  <TableHead className="min-w-[190px] text-xs font-bold text-slate-500">진행 계획</TableHead>
                  <TableHead className="min-w-[110px] text-xs font-bold text-slate-500">최신화 일시</TableHead>
                  <TableHead className="min-w-[168px] text-xs font-bold text-slate-500">현재 페이지</TableHead>
                  <TableHead className="min-w-[84px] text-xs font-bold text-slate-500">입력</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => {
                  const progress = row.progress;
                  const editable = canEditRow(row, currentTeacher);
                  const isSaving = pendingClassId === row.class_id;
                  return (
                    <TableRow key={row.class_id}>
                      <TableCell className="px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          {!editable && <Lock className="h-3.5 w-3.5 text-slate-300" />}
                          {row.class_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-slate-600">{row.teacher_name || "-"}</TableCell>
                      <TableCell>
                        <span className="inline-flex min-w-12 justify-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-600">
                          {row.student_count}명
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <p className="max-w-[220px] whitespace-normal text-sm font-semibold text-slate-800">{progress?.main_textbook || "-"}</p>
                          <ProgressMeter current={progress?.current_page} total={progress?.main_total_pages} />
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.weekly_progress == null ? (
                          <span className="text-xs text-slate-400">-</span>
                        ) : (
                          <span
                            className="inline-flex rounded-full px-2 py-0.5 text-xs font-black"
                            style={{ background: "color-mix(in srgb, var(--accent-warm) 22%, white)", color: "var(--primary)" }}
                          >
                            {row.weekly_progress >= 0 ? `+${row.weekly_progress}p` : `${row.weekly_progress}p`}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[180px] whitespace-normal text-sm text-slate-600">{progress?.sub_textbook || "-"}</TableCell>
                      <TableCell className="max-w-[180px] whitespace-normal text-sm text-slate-600">{progress?.next_textbook || "-"}</TableCell>
                      <TableCell className="max-w-[190px] whitespace-normal text-sm text-slate-600">{progress?.next_start_plan || "-"}</TableCell>
                      <TableCell className="max-w-[240px] whitespace-normal text-sm text-slate-600">{progress?.current_plan || "-"}</TableCell>
                      <TableCell className="text-xs font-semibold text-slate-500">{formatDate(progress?.progress_updated_at)}</TableCell>
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
      />
    </div>
  );
}
