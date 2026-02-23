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

/** 반별 학생 수 클릭 시 학생 이름 표시 */
function StudentCountBadge({ className, students }: { className: string; students: Student[] }) {
  const [showNames, setShowNames] = useState(false);
  const matched = useMemo(
    () => students.filter((s) => s.assigned_class === className),
    [className, students]
  );

  if (matched.length === 0) {
    return <span className="text-xs text-slate-400">0명</span>;
  }

  return (
    <span className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setShowNames(!showNames); }}
        className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
      >
        {matched.length}명
      </button>
      {showNames && (
        <div
          className="absolute left-0 top-6 z-50 bg-white rounded-xl border border-slate-200 shadow-lg p-3 min-w-[160px] max-h-[200px] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs font-bold text-slate-500 mb-1.5">{className} 학생 목록</p>
          {matched.map((s) => (
            <div key={s.id} className="text-sm text-slate-700 py-0.5">
              {s.name}
              {s.school ? <span className="text-xs text-slate-400 ml-1">({s.school})</span> : null}
            </div>
          ))}
          <button
            onClick={() => setShowNames(false)}
            className="mt-2 text-xs text-slate-400 hover:text-slate-600"
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
        count += students.filter((s) => s.assigned_class === cls.name).length;
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
      <div className="bg-white rounded-2xl border border-slate-200" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.02)" }}>
        <div className="bg-[#f8fafc] border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            반 정보 관리
          </h3>
          <button
            onClick={handleAdd}
            className="h-7 px-3 rounded-lg text-white text-xs font-bold flex items-center gap-1 transition-all hover:-translate-y-px"
            style={{ background: "#0F2B5B" }}
          >
            <Plus className="h-3 w-3" />
            추가
          </button>
        </div>

        {/* 과목 필터 */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-2" style={{ background: "#FAFBFD" }}>
          <span className="text-[11px] text-slate-400 mr-0.5">과목</span>
          <button
            onClick={() => setSubjectFilter("")}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
              !subjectFilter ? "bg-slate-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            전체 <span className="text-[10px] opacity-80">{classes.length}</span>
          </button>
          <button
            onClick={() => setSubjectFilter("수학")}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
              subjectFilter === "수학" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            수학 <span className="text-[10px] opacity-80">{subjectCounts.math}</span>
          </button>
          <button
            onClick={() => setSubjectFilter("영어")}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
              subjectFilter === "영어" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
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
                <Button size="sm" onClick={handleAdd} className="rounded-lg text-white text-xs" style={{ background: "#0F2B5B" }}>
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
                    className="w-full px-6 py-3 flex items-center gap-2 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                    <span className="text-sm font-bold text-slate-700">{grade}</span>
                    <span className="text-xs text-slate-400 font-medium">{items.length}개 반</span>
                    <span className="flex items-center gap-1 text-xs text-blue-500 font-medium ml-1">
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
                          className="px-6 py-3 flex items-center gap-4 border-t border-slate-50 hover:bg-[#F8FAFC] transition-colors"
                        >
                          <span className="font-medium text-sm text-slate-800 min-w-[120px]">{cls.name}</span>
                          <span className="text-sm text-slate-600 min-w-[80px]">{cls.teacher || "-"}</span>
                          <StudentCountBadge className={cls.name} students={students} />
                          <span className="hidden md:block text-sm text-slate-500 flex-1">{cls.class_days || "-"}</span>
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
