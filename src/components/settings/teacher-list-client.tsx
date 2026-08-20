"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Users, Info } from "lucide-react";
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
import { KeyRound, Eye, EyeOff } from "lucide-react";

const SUBJECTS = ["수학", "영어"] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: "총괄관리자",
  teacher: "담임",
  clinic: "클리닉",
  director: "대표",
  principal: "원장",
  manager: "부장",
  staff: "행정팀",
};

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
      className="h-7 rounded-md border border-nk-line-soft bg-nk-surface px-1.5 text-xs text-nk-ink focus:outline-none focus:ring-2 focus:ring-nk-progress focus:border-nk-progress disabled:opacity-50"
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
  const [subjectFilter, setSubjectFilter] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);

  // 서버(getTeachers)가 admin에게만 password를 채워서 내려줌 — 값이 하나라도 있으면 대표 화면
  const canSeePasswords = teachers.some((t) => t.password != null);

  const filteredTeachers = teachers.filter((t) => {
    if (activeTab === "teacher") { if (t.role === "clinic") return false; }
    else { if (t.role !== "clinic") return false; }
    if (subjectFilter && t.subject !== subjectFilter) return false;
    return true;
  });

  // 현재 탭 기준 과목별 인원수
  const subjectCounts = (() => {
    const base = teachers.filter((t) => activeTab === "teacher" ? t.role !== "clinic" : t.role === "clinic");
    return {
      math: base.filter((t) => t.subject === "수학").length,
      eng: base.filter((t) => t.subject === "영어").length,
    };
  })();

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
      <div className="bg-nk-surface rounded-2xl border border-nk-line-soft overflow-hidden" style={{ boxShadow: "0 1px 3px rgb(var(--wr-navy-strong) / 0.02), 0 4px 12px rgb(var(--wr-navy-strong) / 0.02)" }}>
        <div className="bg-[rgb(var(--wr-sunken))] border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-nk-ink flex items-center gap-2">
              <Users className="h-5 w-5" />
              선생님 정보 관리
            </h3>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nk-progress-soft border border-nk-progress">
              <Info className="h-3.5 w-3.5 text-nk-progress flex-shrink-0" />
              <span className="text-[11px] text-nk-progress">
                로그인: <b>전화번호</b> + 비밀번호 | 초기 비밀번호: <b>1234</b>
              </span>
            </div>
          </div>
          <button
            onClick={handleAdd}
            className="h-7 px-3 rounded-lg text-nk-navy-ink text-xs font-bold flex items-center gap-1 transition-all hover:-translate-y-px"
            style={{ background: "var(--primary)" }}
          >
            <Plus className="h-3 w-3" />
            추가
          </button>
        </div>

        {/* 담임 / 클리닉 탭 */}
        <div className="px-6 py-3 border-b border-nk-line-soft flex items-center gap-2" style={{ background: "rgb(var(--wr-sunken))" }}>
          <button
            onClick={() => { setActiveTab("teacher"); setSubjectFilter(""); }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === "teacher"
                ? "text-nk-navy-ink shadow-sm"
                : "bg-nk-sunken text-nk-ink-sub hover:bg-nk-line"
            }`}
            style={activeTab === "teacher" ? { background: "var(--primary)" } : undefined}
          >
            담임 선생님
            <span className={`ml-1.5 text-[10px] font-bold ${activeTab === "teacher" ? "text-nk-navy-ink/70" : "text-nk-ink-hint"}`}>
              {teacherCount}
            </span>
          </button>
          <button
            onClick={() => { setActiveTab("clinic"); setSubjectFilter(""); }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === "clinic"
                ? "text-nk-navy-ink shadow-sm"
                : "bg-nk-sunken text-nk-ink-sub hover:bg-nk-line"
            }`}
            style={activeTab === "clinic" ? { background: "rgb(var(--wr-cat-3))" } : undefined}
          >
            클리닉 선생님
            <span className={`ml-1.5 text-[10px] font-bold ${activeTab === "clinic" ? "text-nk-cat-3-soft" : "text-nk-ink-hint"}`}>
              {clinicCount}
            </span>
          </button>
          {activeTab === "clinic" && (
            <span className="text-[11px] text-nk-ink-hint ml-2">※ 클리닉 선생님은 로그인 불가</span>
          )}
          <div className="h-5 w-px bg-nk-line mx-1" />
          <span className="text-[11px] text-nk-ink-hint mr-0.5">과목</span>
          <button
            onClick={() => setSubjectFilter("")}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
              !subjectFilter ? "bg-nk-ink-sub text-nk-navy-ink" : "bg-nk-sunken text-nk-ink-sub hover:bg-nk-line"
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setSubjectFilter("수학")}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
              subjectFilter === "수학" ? "bg-nk-progress text-nk-navy-ink" : "bg-nk-sunken text-nk-ink-sub hover:bg-nk-line"
            }`}
          >
            수학 <span className="text-[10px] opacity-80">{subjectCounts.math}</span>
          </button>
          <button
            onClick={() => setSubjectFilter("영어")}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
              subjectFilter === "영어" ? "bg-nk-done text-nk-navy-ink" : "bg-nk-sunken text-nk-ink-sub hover:bg-nk-line"
            }`}
          >
            영어 <span className="text-[10px] opacity-80">{subjectCounts.eng}</span>
          </button>
        </div>

        {filteredTeachers.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title={activeTab === "clinic" ? "등록된 클리닉 선생님이 없습니다" : "등록된 선생님이 없습니다"}
              description="새로운 선생님을 추가해보세요"
              action={
                <Button size="sm" onClick={handleAdd} className="rounded-lg text-nk-navy-ink text-xs" style={{ background: "var(--primary)" }}>
                  <Plus className="h-3 w-3 mr-1" />
                  선생님 추가
                </Button>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-[rgb(var(--wr-sunken))] hover:bg-[rgb(var(--wr-sunken))]">
                <TableHead className="px-4 py-3 text-xs font-semibold text-nk-ink-sub">이름</TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold text-nk-ink-sub">역할</TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold text-nk-ink-sub">담당과목</TableHead>
                <TableHead className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-nk-ink-sub">아이디 (전화번호)</TableHead>
                {canSeePasswords && (
                  <TableHead className="px-4 py-3 text-xs font-semibold text-nk-ink-sub">
                    <button
                      type="button"
                      onClick={() => setShowPasswords((v) => !v)}
                      className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition hover:bg-nk-line/60"
                      title={showPasswords ? "비밀번호 가리기" : "비밀번호 보기"}
                    >
                      비밀번호
                      {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </TableHead>
                )}
                <TableHead className="w-[100px] px-4 py-3"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeachers.map((teacher) => (
                <TableRow key={teacher.id} className="hover:bg-[rgb(var(--wr-sunken))] border-b border-[rgb(var(--wr-sunken))] last:border-0">
                  <TableCell className="px-4 py-3.5 font-medium text-sm text-nk-ink">{teacher.name}</TableCell>
                  <TableCell className="px-4 py-2">
                    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                      teacher.role === "clinic"
                        ? "bg-nk-cat-3-soft text-nk-cat-3"
                        : teacher.role === "admin"
                          ? "bg-nk-warn-soft text-nk-warn"
                          : "bg-nk-progress-soft text-nk-progress"
                    }`}>
                      {ROLE_LABELS[teacher.role || "teacher"] || teacher.role || "담임"}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <InlineSubjectSelect teacher={teacher} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-4 py-3.5 text-sm text-nk-ink-sub">
                    {formatPhoneDisplay(teacher.phone)}
                  </TableCell>
                  {canSeePasswords && (
                    <TableCell className="px-4 py-3.5">
                      {teacher.password != null ? (
                        <span className="font-mono text-sm font-bold text-nk-ink">
                          {showPasswords ? teacher.password : "••••"}
                          {teacher.password === "1234" && showPasswords && (
                            <span className="ml-1.5 rounded bg-nk-warn-soft px-1.5 py-0.5 text-[10px] font-bold text-nk-warn">초기</span>
                          )}
                        </span>
                      ) : (
                        <span
                          className="text-[11px] font-semibold text-nk-ink-hint"
                          title="다른 앱에서 변경되어 확인할 수 없습니다. 비밀번호 초기화(열쇠 버튼)로 1234로 재설정할 수 있습니다."
                        >
                          확인 불가
                        </span>
                      )}
                    </TableCell>
                  )}
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
              &quot;{deleteTarget?.name}&quot; 선생님을 퇴사 처리하시겠습니까? 목록에서 사라지고 로그인이 차단되며, 과거 기록은 보존됩니다.
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
