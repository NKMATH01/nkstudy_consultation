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
import { TeacherFormDialog } from "@/components/settings/teacher-form";
import { deleteTeacher } from "@/lib/actions/settings";
import type { Teacher } from "@/types";

interface Props {
  teachers: Teacher[];
}

export function TeacherList({ teachers }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Teacher | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Teacher | undefined>();

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
            style={{
              background: "#0F2B5B",
            }}
          >
            <Plus className="h-3 w-3" />
            추가
          </button>
        </div>

        {teachers.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title="등록된 선생님이 없습니다"
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
                <TableHead className="px-4 py-3 text-xs font-semibold text-slate-500">담당과목</TableHead>
                <TableHead className="hidden sm:table-cell px-4 py-3 text-xs font-semibold text-slate-500">담당학년</TableHead>
                <TableHead className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-slate-500">연락처</TableHead>
                <TableHead className="w-[60px] px-4 py-3"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((teacher) => (
                <TableRow key={teacher.id} className="hover:bg-[#F8FAFC] border-b border-[#f1f5f9] last:border-0">
                  <TableCell className="px-4 py-3.5 font-medium text-sm text-slate-800">{teacher.name}</TableCell>
                  <TableCell className="px-4 py-3.5 text-sm text-slate-600">{teacher.subject || "-"}</TableCell>
                  <TableCell className="hidden sm:table-cell px-4 py-3.5 text-sm text-slate-600">
                    {teacher.target_grade || "-"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-4 py-3.5 text-sm text-slate-600">
                    {teacher.phone || "-"}
                  </TableCell>
                  <TableCell className="px-4 py-3.5">
                    <div className="flex gap-1">
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
    </>
  );
}
