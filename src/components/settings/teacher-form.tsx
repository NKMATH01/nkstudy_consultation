"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  teacherFormSchema,
  type TeacherFormValues,
} from "@/lib/validations/class";
import { createTeacher, updateTeacher } from "@/lib/actions/settings";
import type { Teacher } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher?: Teacher;
}

export function TeacherFormDialog({ open, onOpenChange, teacher }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!teacher;

  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherFormSchema) as never,
    defaultValues: {
      name: teacher?.name ?? "",
      subject: teacher?.subject ?? "",
      target_grade: teacher?.target_grade ?? "",
      phone: teacher?.phone ?? "",
    },
  });

  const onSubmit = (values: TeacherFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.set(key, String(value));
        }
      });

      const result = isEdit
        ? await updateTeacher(teacher!.id, formData)
        : await createTeacher(formData);

      if (result.success) {
        toast.success(
          isEdit ? "선생님 정보가 수정되었습니다" : "선생님이 등록되었습니다"
        );
        onOpenChange(false);
        form.reset();
        router.refresh();
      } else {
        toast.error(result.error || "오류가 발생했습니다");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "선생님 수정" : "선생님 등록"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이름 *</FormLabel>
                  <FormControl>
                    <Input placeholder="선생님 이름" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>담당 과목</FormLabel>
                  <FormControl>
                    <Input placeholder="예: 수학" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="target_grade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>담당 학년</FormLabel>
                  <FormControl>
                    <Input placeholder="예: 중1~중3" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>연락처</FormLabel>
                  <FormControl>
                    <Input placeholder="010-0000-0000" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                취소
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "저장 중..." : isEdit ? "수정" : "등록"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
