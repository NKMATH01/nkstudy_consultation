"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, BookOpen, ChevronDown, ChevronRight, Users } from "lucide-react";
import { toast } from "sonner";
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
import { ClassFormDialog } from "@/components/settings/class-form-client";
import { deleteClass } from "@/lib/actions/settings";
import type { Class, Teacher, Student } from "@/types";

interface Props {
  classes: Class[];
  teachers: Teacher[];
  students: Student[];
}

/** 반 이름에서 학년 추출 */
function extractGradeFromName(name: string): string | null {
  const match = name.match(/^(초[3-6]|중[1-3]|고[1-3])/);
  return match ? match[1] : null;
}

const GRADE_ORDER = ["초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3"];

function gradeSort(a: string, b: string): number {
  const ia = GRADE_ORDER.indexOf(a);
  const ib = GRADE_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

function normalizeClassName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[-‐‑‒–—―−]/g, "")
    .replace(/[()（）]?\s*2관\s*[)）]?/gi, "")
    .trim()
    .toUpperCase();
}

function isSameClassName(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeClassName(a);
  const right = normalizeClassName(b);
  return left.length > 0 && left === right;
}

/** 반별 학생 수 클릭 시 학생 이름 표시 */
function StudentCountBadge({ className, students }: { className: string; students: Student[] }) {
  const [showNames, setShowNames] = useState(false);
  const matched = useMemo(
    () => students.filter((s) => isSameClassName(s.assigned_class, className)),
    [className, students]
  );

  if (matched.length === 0) {
    return <span className="inline-flex min-w-12 justify-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-400">0명</span>;
  }

  return (
    <span className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setShowNames(!showNames); }}
        className="inline-flex min-w-12 justify-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 shadow-sm transition hover:-translate-y-px hover:border-blue-300 hover:bg-blue-100"
      >
        {matched.length}명
      </button>
      {showNames && (
        <div
          className="absolute left-0 top-7 z-50 max-h-[220px] min-w-[180px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-[0_18px_48px_rgba(15,23,42,0.16)]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 border-b border-slate-100 pb-1.5 text-xs font-bold text-slate-600">{className} 학생 목록</p>
          {matched.map((s) => (
            <div key={s.id} className="rounded-md px-1 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50">
              {s.name}
              {s.school ? <span className="text-xs text-slate-400 ml-1">({s.school})</span> : null}
            </div>
          ))}
          <button
            onClick={() => setShowNames(false)}
            className="mt-2 rounded-md px-1.5 py-1 text-xs font-semibold text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
          >
            닫기
          </button>
        </div>
      )}
    </span>
  );
}

export function ClassList({ classes, teachers, students }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Class | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Class | undefined>();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [subjectFilter, setSubjectFilter] = useState("");

  // 반의 과목 (담당 선생님의 과목으로 판별)
  const getClassSubject = (cls: Class): string | null => {
    if (!cls.teacher) return null;
    const t = teachers.find((tc) => tc.name === cls.teacher);
    return t?.subject || null;
  };

  const filteredBySubject = useMemo(() => {
    if (!subjectFilter) return classes;
    return classes.filter((cls) => getClassSubject(cls) === subjectFilter);
  }, [classes, subjectFilter, teachers]);

  const subjectCounts = useMemo(() => ({
    math: classes.filter((c) => getClassSubject(c) === "수학").length,
    eng: classes.filter((c) => getClassSubject(c) === "영어").length,
  }), [classes, teachers]);

  // 학년별 그룹화
  const grouped = useMemo(() => {
    const map: Record<string, Class[]> = {};
    for (const cls of filteredBySubject) {
      const grade = cls.target_grade || extractGradeFromName(cls.name) || "기타";
      if (!map[grade]) map[grade] = [];
      map[grade].push(cls);
    }
    const sortedKeys = Object.keys(map).sort(gradeSort);
    return sortedKeys.map((grade) => ({ grade, items: map[grade] }));
  }, [filteredBySubject]);

  // 학년별 학생 수 합계
  const gradeStudentCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const { grade, items } of grouped) {
      let count = 0;
      for (const cls of items) {
        count += students.filter((s) => isSameClassName(s.assigned_class, cls.name)).length;
      }
      map[grade] = count;
    }
    return map;
  }, [grouped, students]);

  const toggleExpand = (grade: string) => {
    setExpanded((prev) => ({ ...prev, [grade]: !prev[grade] }));
  };

  const handleEdit = (cls: Class) => {
    setEditTarget(cls);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditTarget(undefined);
    setShowForm(true);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteClass(deleteTarget.id);
      if (result.success) {
        toast.success("반이 삭제되었습니다");
        setDeleteTarget(undefined);
        router.refresh();
      } else {
        toast.error(result.error || "삭제에 실패했습니다");
      }
    });
  };

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between border-b border-slate-200/70 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-4">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
              <BookOpen className="h-4 w-4 text-[var(--primary)]" />
            </span>
            반 정보 관리
          </h3>
          <button
            onClick={handleAdd}
            className="flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-bold text-white shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
            style={{ background: "var(--primary)" }}
          >
            <Plus className="h-3 w-3" />
            추가
          </button>
        </div>

        {/* 과목 필터 */}
        <div className="flex items-center gap-2 border-b border-slate-100 bg-[#FBFCFE] px-6 py-3">
          <span className="mr-0.5 text-[11px] font-bold text-slate-400">과목</span>
          <button
            onClick={() => setSubjectFilter("")}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-bold shadow-sm transition-all ${
              !subjectFilter ? "border-slate-700 bg-slate-700 text-white" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            전체 <span className="text-[10px] opacity-80">{classes.length}</span>
          </button>
          <button
            onClick={() => setSubjectFilter("수학")}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-bold shadow-sm transition-all ${
              subjectFilter === "수학" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:bg-blue-50 hover:text-blue-700"
            }`}
          >
            수학 <span className="text-[10px] opacity-80">{subjectCounts.math}</span>
          </button>
          <button
            onClick={() => setSubjectFilter("영어")}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-bold shadow-sm transition-all ${
              subjectFilter === "영어" ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
            }`}
          >
            영어 <span className="text-[10px] opacity-80">{subjectCounts.eng}</span>
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={BookOpen}
              title="등록된 반이 없습니다"
              description="새로운 반을 추가해보세요"
              action={
                <Button size="sm" onClick={handleAdd} className="rounded-lg text-white text-xs" style={{ background: "var(--primary)" }}>
                  <Plus className="h-3 w-3 mr-1" />
                  반 추가
                </Button>
              }
            />
          </div>
        ) : (
          <div>
            {grouped.map(({ grade, items }) => {
              const isCollapsed = !(expanded[grade] ?? false);
              const totalStudents = gradeStudentCount[grade] || 0;
              return (
                <div key={grade} className="border-b border-slate-100 last:border-b-0">
                  {/* 학년 헤더 */}
                  <button
                    onClick={() => toggleExpand(grade)}
                    className="flex w-full items-center gap-2 bg-slate-50/80 px-6 py-3 text-left transition-colors hover:bg-slate-100/80"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 rounded-md text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 rounded-md text-slate-400" />
                    )}
                    <span className="text-sm font-extrabold text-slate-800">{grade}</span>
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 shadow-sm">{items.length}개 반</span>
                    <span className="ml-1 flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-600">
                      <Users className="h-3 w-3" />
                      {totalStudents}명
                    </span>
                  </button>

                  {/* 반 목록 */}
                  {!isCollapsed && (
                    <div>
                      {items.map((cls) => (
                        <div
                          key={cls.id}
                          className="flex items-center gap-4 border-t border-slate-100 px-6 py-3.5 transition-colors hover:bg-slate-50/70"
                        >
                          <span className="min-w-[120px] text-sm font-bold text-slate-800">{cls.name}</span>
                          <span className="min-w-[80px] rounded-md border border-slate-200 bg-white px-2 py-0.5 text-sm font-medium text-slate-600 shadow-sm">{cls.teacher || "-"}</span>
                          <StudentCountBadge className={cls.name} students={students} />
                          <span className="hidden flex-1 text-sm text-slate-500 md:block">{cls.class_days || "-"}</span>
                          <div className="flex gap-1 ml-auto">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(cls)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(cls)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ClassFormDialog open={showForm} onOpenChange={setShowForm} classData={editTarget} teachers={teachers} />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>반 삭제</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot; 반을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(undefined)}>취소</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
