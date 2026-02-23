"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, GraduationCap, Filter } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/empty-state";
import { StudentFormDialog } from "@/components/settings/student-form-client";
import { createStudent, deleteStudent } from "@/lib/actions/settings";
import type { Student, Teacher, Class } from "@/types";
import { GRADES } from "@/types";

// ── 전화번호 자동 하이픈 ──
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

// ── 반 이름에서 학년 추출 ──
function extractGradeFromClassName(name: string): string | null {
  const match = name.match(/^(초[3-6]|중[1-3]|고[1-3])/);
  return match ? match[1] : null;
}

// ── 고등학교 특수과목 반 판별 ──
const HIGH_SCHOOL_SUBJECTS = ["기하", "확통", "미적"];
function isHighSchoolSubjectClass(className: string): boolean {
  return HIGH_SCHOOL_SUBJECTS.some((s) => className.startsWith(s));
}

// ── 학생의 실제 학년 판별 (grade 숫자 + class_name 조합) ──
function resolveStudentGrade(student: { grade?: string | null; assigned_class?: string | null }): string | null {
  // 1. class_name에서 학년 추출 (가장 정확)
  if (student.assigned_class) {
    const fromClass = extractGradeFromClassName(student.assigned_class);
    if (fromClass) return fromClass;
    // 기하/확통/미적 등 고등학교 특수과목 반 → 고3 고정
    if (isHighSchoolSubjectClass(student.assigned_class)) {
      return "고3";
    }
  }
  // 2. grade가 이미 "초3", "중1" 형식이면 그대로
  if (student.grade && /^(초[3-6]|중[1-3]|고[1-3])$/.test(student.grade)) {
    return student.grade;
  }
  return null;
}

// ── Props ──
interface Props {
  students: Student[];
  teachers: Teacher[];
  classes: Class[];
}

// ── 등록 상태 ──
function getRegistrationStatus(registrationDate: string | null): { label: string; className: string } {
  if (!registrationDate) {
    return { label: "-", className: "text-slate-400" };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const regDate = new Date(registrationDate);
  regDate.setHours(0, 0, 0, 0);

  if (regDate <= today) {
    return {
      label: "등록",
      className: "bg-emerald-100 text-emerald-700 font-bold text-xs px-2 py-0.5 rounded-full",
    };
  }
  return {
    label: "등록대기",
    className: "bg-amber-100 text-amber-700 font-bold text-xs px-2 py-0.5 rounded-full",
  };
}

// ── localStorage 기반 등록일 (DB 컬럼 추가 전 임시) ──
const REG_DATE_KEY = "nk_student_reg_dates";

function getStoredRegDates(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(REG_DATE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setStoredRegDate(studentId: string, date: string | null) {
  const dates = getStoredRegDates();
  if (date) {
    dates[studentId] = date;
  } else {
    delete dates[studentId];
  }
  localStorage.setItem(REG_DATE_KEY, JSON.stringify(dates));
}

function getEffectiveRegDate(student: Student): string {
  if (student.registration_date) return student.registration_date;
  const stored = getStoredRegDates();
  return stored[student.id] || "";
}

// ── 인라인 날짜 입력 ──
function InlineDateInput({ student }: { student: Student }) {
  const [value, setValue] = useState("");

  useState(() => {
    if (typeof window !== "undefined") {
      setValue(getEffectiveRegDate(student));
    }
  });

  const handleChange = (newValue: string) => {
    setValue(newValue);
    setStoredRegDate(student.id, newValue || null);
  };

  return (
    <input
      type="date"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className="h-7 w-[120px] rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    />
  );
}

// ── 상태 뱃지 ──
function StatusBadge({ student }: { student: Student }) {
  const [regDate, setRegDate] = useState("");

  useState(() => {
    if (typeof window !== "undefined") {
      setRegDate(getEffectiveRegDate(student));
    }
  });

  const stored = typeof window !== "undefined" ? getStoredRegDates() : {};
  const effective = student.registration_date || stored[student.id] || regDate;
  const status = getRegistrationStatus(effective || null);

  return <span className={status.className}>{status.label}</span>;
}

// ── 인라인 추가 행 ──
function InlineAddRow({ classes, onAdded }: { classes: Class[]; onAdded: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [regDate, setRegDate] = useState("");
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [assignedClass, setAssignedClass] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");

  // 학년에 맞는 반 필터링
  const filteredClasses = useMemo(() => {
    if (!grade) return classes;
    return classes.filter((c) => {
      if (extractGradeFromClassName(c.name) === grade) return true;
      if (grade === "고3" && isHighSchoolSubjectClass(c.name)) return true;
      return false;
    });
  }, [grade, classes]);

  const inputCls = "h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const selectCls = "h-7 w-full rounded-md border border-slate-200 bg-white px-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("이름을 입력해주세요");
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name.trim());
      if (school) formData.set("school", school);
      if (grade) formData.set("grade", grade);
      if (assignedClass) formData.set("assigned_class", assignedClass);
      if (studentPhone) formData.set("student_phone", studentPhone);
      if (parentPhone) formData.set("parent_phone", parentPhone);

      const result = await createStudent(formData);
      if (result.success) {
        toast.success("학생이 등록되었습니다");
        if (regDate) setStoredRegDate("temp", regDate); // TODO: 실제 ID 필요
        setRegDate(""); setName(""); setSchool(""); setGrade(""); setAssignedClass("");
        setStudentPhone(""); setParentPhone("");
        onAdded();
      } else {
        toast.error(result.error || "등록 실패");
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <TableRow className="bg-blue-50/40 border-b border-blue-100">
      <TableCell className="px-4 py-2">
        <input type="date" className={inputCls + " w-[120px]"} value={regDate} onChange={(e) => setRegDate(e.target.value)} />
      </TableCell>
      <TableCell className="px-4 py-2" />
      <TableCell className="px-4 py-2">
        <input className={inputCls} placeholder="이름 *" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={handleKeyDown} />
      </TableCell>
      <TableCell className="px-4 py-2">
        <input className={inputCls} placeholder="학교" value={school} onChange={(e) => setSchool(e.target.value)} onKeyDown={handleKeyDown} />
      </TableCell>
      <TableCell className="hidden sm:table-cell px-4 py-2">
        <select className={selectCls} value={grade} onChange={(e) => { setGrade(e.target.value); setAssignedClass(""); }}>
          <option value="">학년</option>
          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </TableCell>
      <TableCell className="hidden md:table-cell px-4 py-2">
        <select className={selectCls} value={assignedClass} onChange={(e) => setAssignedClass(e.target.value)}>
          <option value="">배정반</option>
          {filteredClasses.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </TableCell>
      <TableCell className="hidden md:table-cell px-4 py-2">
        <input className={inputCls} placeholder="학생 연락처" value={studentPhone} onChange={(e) => setStudentPhone(formatPhone(e.target.value))} onKeyDown={handleKeyDown} />
      </TableCell>
      <TableCell className="hidden lg:table-cell px-4 py-2">
        <input className={inputCls} placeholder="학부모 연락처" value={parentPhone} onChange={(e) => setParentPhone(formatPhone(e.target.value))} onKeyDown={handleKeyDown} />
      </TableCell>
      <TableCell className="px-4 py-2">
        <Button size="sm" className="h-7 px-2 rounded-lg text-white text-xs" style={{ background: "#0F2B5B" }} onClick={handleSave} disabled={isPending}>
          {isPending ? "..." : "저장"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ── 필터 드롭다운 스타일 ──
const filterSelectCls = "h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

// ── 메인 컴포넌트 ──
export function StudentList({ students, teachers, classes }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Student | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Student | undefined>();

  // 필터 상태
  const [filterGrade, setFilterGrade] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // 학년에 맞는 반 목록 (classes 테이블 + 학생 실제 배정반 합치기)
  const classesForGrade = useMemo(() => {
    if (!filterGrade) return classes;
    return classes.filter((c) => {
      if (extractGradeFromClassName(c.name) === filterGrade) return true;
      if (filterGrade === "고3" && isHighSchoolSubjectClass(c.name)) return true;
      return false;
    });
  }, [filterGrade, classes]);

  // 학생 목록에서 사용되는 고유 배정반 목록
  const uniqueClasses = useMemo(() => {
    const set = new Set(students.map((s) => s.assigned_class).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [students]);

  // 학년 필터 시 표시할 반 목록 (classes 테이블 + 학생 데이터 병합)
  const classOptionsForFilter = useMemo(() => {
    if (!filterGrade) return uniqueClasses;
    // classes 테이블에서 해당 학년 반 이름
    const fromTable = new Set(classesForGrade.map((c) => c.name));
    // 학생 데이터에서 해당 학년에 해당하는 반 이름
    students.forEach((s) => {
      if (s.assigned_class && resolveStudentGrade(s) === filterGrade) {
        fromTable.add(s.assigned_class);
      }
    });
    return Array.from(fromTable).sort();
  }, [filterGrade, classesForGrade, students, uniqueClasses]);

  // 필터 적용
  const filteredStudents = useMemo(() => {
    let result = students;

    if (filterGrade) {
      result = result.filter((s) => {
        const resolved = resolveStudentGrade(s);
        return resolved === filterGrade;
      });
    }

    if (filterClass) {
      result = result.filter((s) => s.assigned_class === filterClass);
    }

    if (filterStatus) {
      result = result.filter((s) => {
        const effective = getEffectiveRegDate(s);
        const status = getRegistrationStatus(effective || null);
        if (filterStatus === "등록") return status.label === "등록";
        if (filterStatus === "등록대기") return status.label === "등록대기";
        if (filterStatus === "미등록") return status.label === "-";
        return true;
      });
    }

    return result;
  }, [students, filterGrade, filterClass, filterStatus]);

  const hasActiveFilter = filterGrade || filterClass || filterStatus;

  const handleEdit = (student: Student) => {
    setEditTarget(student);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditTarget(undefined);
    setShowForm(true);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteStudent(deleteTarget.id);
      if (result.success) {
        toast.success("학생이 삭제되었습니다");
        setDeleteTarget(undefined);
        router.refresh();
      } else {
        toast.error(result.error || "삭제에 실패했습니다");
      }
    });
  };

  const clearFilters = () => {
    setFilterGrade("");
    setFilterClass("");
    setFilterStatus("");
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.02)" }}>
        <div className="bg-[#f8fafc] border-b px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            학생 정보 관리
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

        {/* 필터 영역 */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <Filter className="h-4 w-4 text-slate-400" />
          <select className={filterSelectCls} value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setFilterClass(""); }}>
            <option value="">전체 학년</option>
            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select className={filterSelectCls} value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
            <option value="">전체 반</option>
            {classOptionsForFilter.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className={filterSelectCls} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">전체 상태</option>
            <option value="등록">등록</option>
            <option value="등록대기">등록대기</option>
            <option value="미등록">미등록</option>
          </select>
          {hasActiveFilter && (
            <button onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              필터 초기화
            </button>
          )}
          {hasActiveFilter && (
            <span className="text-xs text-slate-400 ml-auto">
              {filteredStudents.length}명 / {students.length}명
            </span>
          )}
        </div>

        {students.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={GraduationCap}
              title="등록된 학생이 없습니다"
              description="새로운 학생을 추가해보세요"
              action={
                <Button size="sm" onClick={handleAdd} className="rounded-lg text-white text-xs" style={{ background: "#0F2B5B" }}>
                  <Plus className="h-3 w-3 mr-1" />
                  학생 추가
                </Button>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f8fafc] hover:bg-[#f8fafc]">
                <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">등록일</TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">상태</TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">이름</TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">학교</TableHead>
                <TableHead className="hidden sm:table-cell px-4 py-3 text-xs font-semibold text-slate-500">학년</TableHead>
                <TableHead className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-slate-500">배정반</TableHead>
                <TableHead className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-slate-500">학생 연락처</TableHead>
                <TableHead className="hidden lg:table-cell px-4 py-3 text-xs font-semibold text-slate-500">학부모 연락처</TableHead>
                <TableHead className="w-[60px] px-4 py-3"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* 빈 입력행 - 바로 학생 등록 */}
              <InlineAddRow classes={classes} onAdded={() => router.refresh()} />
              {filteredStudents.map((student) => (
                <TableRow key={student.id} className="hover:bg-[#F8FAFC] border-b border-[#f1f5f9] last:border-0">
                  <TableCell className="px-4 py-2">
                    <InlineDateInput student={student} />
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <StatusBadge student={student} />
                  </TableCell>
                  <TableCell className="px-4 py-3.5 font-medium text-sm text-slate-800">{student.name}</TableCell>
                  <TableCell className="px-4 py-3.5 text-sm text-slate-600">{student.school || "-"}</TableCell>
                  <TableCell className="hidden sm:table-cell px-4 py-3.5 text-sm text-slate-600">
                    {resolveStudentGrade(student) || student.grade || "-"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-4 py-3.5 text-sm text-slate-600">
                    {student.assigned_class || "-"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-4 py-3.5 text-sm text-slate-600">
                    {student.student_phone || "-"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell px-4 py-3.5 text-sm text-slate-600">
                    {student.parent_phone || "-"}
                  </TableCell>
                  <TableCell className="px-4 py-3.5">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(student)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(student)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <StudentFormDialog open={showForm} onOpenChange={setShowForm} student={editTarget} teachers={teachers} classes={classes} />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>학생 삭제</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot; 학생을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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
