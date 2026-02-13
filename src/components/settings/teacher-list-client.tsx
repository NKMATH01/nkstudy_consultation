"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
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
import { TeacherFormDialog } from "@/components/settings/teacher-form-client";
import { deleteTeacher, updateTeacher, resetTeacherPassword } from "@/lib/actions/settings";
import type { Teacher } from "@/types";
import { KeyRound } from "lucide-react";

const SUBJECTS = ["수학", "영어", "국어", "과학", "사회", "논술", "기타"] as const;

// 전화번호 자동 하이픈
function formatPhoneDisplay(phone: string | null): string {
  if (!phone) return "-";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return phone;
}

// 인라인 과목 드롭다운
function InlineSubjectSelect({ teacher }: { teacher: Teacher }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(teacher.subject || "");

  const handleChange = (newValue: string) => {
    setValue(newValue);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", teacher.name);
      formData.set("subject", newValue);
      if (teacher.phone) formData.set("phone", teacher.phone);

      const result = await updateTeacher(teacher.id, formData);
      if (result.success) {
        toast.success("담당 과목이 변경되었습니다");
        router.refresh();
      } else {
        toast.error(result.error || "변경 실패");
        setValue(teacher.subject || "");
      }
    });
  };

  return (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      disabled={isPending}
      className="h-7 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
    >
      <option value="">선택</option>
      {SUBJECTS.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

type RoleTab = "teacher" | "clinic";

interface Props {
  teachers: Teacher[];
}

export function TeacherList({ teachers }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Teacher | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Teacher | undefined>();
  const [resetTarget, setResetTarget] = useState<Teacher | undefined>();
  const [activeTab, setActiveTab] = useState<RoleTab>("teacher");

  const filteredTeachers = teachers.filter((t) => {
    if (activeTab === "teacher") return t.role !== "clinic";
    return t.role === "clinic";
  });

  const teacherCount = teachers.filter((t) => t.role !== "clinic").length;
  const clinicCount = teachers.filter((t) => t.role === "clinic").length;

  const handleEdit = (teacher: Teacher) => {
    setEditTarget(teacher);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditTarget(undefined);
    setShowForm(true);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteTeacher(deleteTarget.id);
      if (result.success) {
        toast.success("선생님이 삭제되었습니다");
        setDeleteTarget(undefined);
        router.refresh();
      } else {
        toast.error(result.error || "삭제에 실패했습니다");
      }
    });
  };

  const handleResetPassword = () => {
    if (!resetTarget) return;
    startTransition(async () => {
      const result = await resetTeacherPassword(resetTarget.id);
      if (result.success) {
        toast.success(`${resetTarget.name} 선생님 비밀번호가 1234로 초기화되었습니다`);
        setResetTarget(undefined);
        router.refresh();
      } else {
        toast.error(result.error || "비밀번호 초기화에 실패했습니다");
      }
    });
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.02)" }}>
        <div className="bg-[#f8fafc] border-b px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Users className="h-5 w-5" />
            선생님 정보 관리
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

        {/* 담임 / 클리닉 탭 */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-2" style={{ background: "#FAFBFD" }}>
          <button
            onClick={() => setActiveTab("teacher")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === "teacher"
                ? "text-white shadow-sm"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
            style={activeTab === "teacher" ? { background: "#0F2B5B" } : undefined}
          >
            담임 선생님
            <span className={`ml-1.5 text-[10px] font-bold ${activeTab === "teacher" ? "text-[#D4A853]" : "text-slate-400"}`}>
              {teacherCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("clinic")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === "clinic"
                ? "text-white shadow-sm"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
            style={activeTab === "clinic" ? { background: "#7C3AED" } : undefined}
          >
            클리닉 선생님
            <span className={`ml-1.5 text-[10px] font-bold ${activeTab === "clinic" ? "text-violet-200" : "text-slate-400"}`}>
              {clinicCount}
            </span>
          </button>
          {activeTab === "clinic" && (
            <span className="text-[11px] text-slate-400 ml-2">※ 클리닉 선생님은 로그인 불가</span>
          )}
        </div>

        {filteredTeachers.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title={activeTab === "clinic" ? "등록된 클리닉 선생님이 없습니다" : "등록된 선생님이 없습니다"}
              description="새로운 선생님을 추가해보세요"
              action={
                <Button size="sm" onClick={handleAdd} className="rounded-lg text-white text-xs" style={{ background: "#0F2B5B" }}>
                  <Plus className="h-3 w-3 mr-1" />
                  선생님 추가
                </Button>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f8fafc] hover:bg-[#f8fafc]">
                <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">이름</TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">역할</TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">담당과목</TableHead>
                <TableHead className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-slate-500">연락처</TableHead>
                <TableHead className="w-[100px] px-4 py-3"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeachers.map((teacher) => (
                <TableRow key={teacher.id} className="hover:bg-[#F8FAFC] border-b border-[#f1f5f9] last:border-0">
                  <TableCell className="px-4 py-3.5 font-medium text-sm text-slate-800">{teacher.name}</TableCell>
                  <TableCell className="px-4 py-2">
                    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                      teacher.role === "clinic"
                        ? "bg-violet-100 text-violet-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {teacher.role === "clinic" ? "클리닉" : "담임"}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <InlineSubjectSelect teacher={teacher} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-4 py-3.5 text-sm text-slate-600">
                    {formatPhoneDisplay(teacher.phone)}
                  </TableCell>
                  <TableCell className="px-4 py-3.5">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="비밀번호 초기화" onClick={() => setResetTarget(teacher)}>
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(teacher)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(teacher)}>
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

      <TeacherFormDialog open={showForm} onOpenChange={setShowForm} teacher={editTarget} />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>선생님 삭제</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot; 선생님을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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

      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>비밀번호 초기화</DialogTitle>
            <DialogDescription>
              &quot;{resetTarget?.name}&quot; 선생님의 비밀번호를 1234로 초기화하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(undefined)}>취소</Button>
            <Button onClick={handleResetPassword} disabled={isPending}>
              {isPending ? "초기화 중..." : "초기화"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
