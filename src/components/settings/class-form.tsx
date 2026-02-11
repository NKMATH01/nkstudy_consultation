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
  classFormSchema,
  type ClassFormValues,
} from "@/lib/validations/class";
import { createClass, updateClass } from "@/lib/actions/settings";
import type { Class } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classData?: Class;
}

export function ClassFormDialog({ open, onOpenChange, classData }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!classData;

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema) as never,
    defaultValues: {
      name: classData?.name ?? "",
      teacher: classData?.teacher ?? "",
      target_grade: classData?.target_grade ?? "",
      class_days: classData?.class_days ?? "",
      class_time: classData?.class_time ?? "",
      clinic_time: classData?.clinic_time ?? "",
    },
  });

  const onSubmit = (values: ClassFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.set(key, String(value));
        }
      });

      const result = isEdit
        ? await updateClass(classData!.id, formData)
        : await createClass(formData);

      if (result.success) {
        toast.success(isEdit ? "반이 수정되었습니다" : "반이 등록되었습니다");
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
          <DialogTitle>{isEdit ? "반 수정" : "반 등록"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>반 이름 *</FormLabel>
                  <FormControl>
                    <Input placeholder="예: A반" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="teacher"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>담당 선생님</FormLabel>
                  <FormControl>
                    <Input placeholder="선생님 이름" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="target_grade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>대상 학년</FormLabel>
                  <FormControl>
                    <Input placeholder="예: 중1~중2" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="class_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>수업 요일</FormLabel>
                    <FormControl>
                      <Input placeholder="예: 월수금" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="class_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>수업 시간</FormLabel>
                    <FormControl>
                      <Input placeholder="예: 17:00~19:00" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="clinic_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>클리닉 시간</FormLabel>
                  <FormControl>
                    <Input placeholder="예: 19:00~20:00" {...field} />
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
