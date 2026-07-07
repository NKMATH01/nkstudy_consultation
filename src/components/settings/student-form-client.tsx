"use client";

import { useTransition, useEffect, useMemo, useState } from "react";
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
  studentFormSchema,
  type StudentFormValues,
} from "@/lib/validations/class";
import { createStudent, updateStudent } from "@/lib/actions/settings";
import type { Student, Teacher, Class } from "@/types";
import { GRADES } from "@/types";

/** 반 이름에서 학년 추출 (예: "고2-S1(월수)" → "고2") */
function extractGradeFromClassName(name: string): string | null {
  const match = name.match(/^(초[3-6]|중[1-3]|고[1-3])/);
  return match ? match[1] : null;
}

/** 고등학교 특수과목 반 판별 (기하, 미적, 확통 → 고3) */
const HIGH_SCHOOL_SUBJECTS = ["기하", "확통", "미적"];
function isHighSchoolSubjectClass(className: string): boolean {
  return HIGH_SCHOOL_SUBJECTS.some((s) => className.startsWith(s));
}

/** 학생의 유효 학년: grade 필드가 GRADES에 있으면 그대로, 없으면 배정반에서 추출 */
function resolveGrade(student?: Student): string {
  if (!student) return "";
  const g = student.grade ?? "";
  if ((GRADES as readonly string[]).includes(g)) return g;
  // 배정반 이름에서 학년 추출
  if (student.assigned_class) {
    const extracted = extractGradeFromClassName(student.assigned_class);
    if (extracted) return extracted;
  }
  return g;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: Student;
  teachers?: Teacher[];
  classes?: Class[];
}

export function StudentFormDialog({ open, onOpenChange, student, teachers = [], classes = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!student;
  // 배정반 목록의 기준 학년 override — null이면 학생 학년(selectedGrade)을 따름.
  // 초4 학생을 초3 반에 넣는 등 다른 학년 반 배정을 허용한다.
  const [classGradeOverride, setClassGradeOverride] = useState<string | null>(null);

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema) as never,
    defaultValues: {
      name: "",
      school: "",
      grade: "",
      student_phone: "",
      parent_phone: "",
      assigned_class: "",
      teacher: "",
      memo: "",
      registration_date: "",
    },
  });

  useEffect(() => {
    if (open && student) {
      const resolved = resolveGrade(student);
      form.reset({
        name: student.name ?? "",
        school: student.school ?? "",
        grade: resolved,
        student_phone: student.student_phone ?? "",
        parent_phone: student.parent_phone ?? "",
        assigned_class: student.assigned_class ?? "",
        teacher: student.teacher ?? "",
        memo: (student.memo ?? "").replace(/^\[REG:[^\]]*\]\s*/, ""),
        registration_date: student.registration_date ?? "",
      });
      // 이미 다른 학년 반에 배정된 학생이면 그 반의 학년으로 override —
      // 그래야 현재 배정반이 목록에 있어 select가 비어 보이지 않는다.
      const clsGrade = student.assigned_class
        ? extractGradeFromClassName(student.assigned_class)
        : null;
      setClassGradeOverride(clsGrade && clsGrade !== resolved ? clsGrade : null);
    } else if (open) {
      form.reset({
        name: "",
        school: "",
        grade: "",
        student_phone: "",
        parent_phone: "",
        assigned_class: "",
        teacher: "",
        memo: "",
        registration_date: "",
      });
      setClassGradeOverride(null);
    }
  }, [open, student, form]);

  // 선택된 학년에 맞는 반 목록 필터링 (override가 있으면 그 학년 기준)
  const selectedGrade = form.watch("grade");
  const classBaseGrade = classGradeOverride ?? selectedGrade;
  const filteredClasses = useMemo(() => {
    if (!classBaseGrade) return classes;
    return classes.filter((c) => {
      if (extractGradeFromClassName(c.name) === classBaseGrade) return true;
      // 고3 기준일 때 기하/미적/확통 등 특수과목 반도 포함
      if (classBaseGrade === "고3" && isHighSchoolSubjectClass(c.name)) return true;
      return false;
    });
  }, [classBaseGrade, classes]);

  const onSubmit = (values: StudentFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.set(key, String(value));
        }
      });

      const result = isEdit
        ? await updateStudent(student!.id, formData)
        : await createStudent(formData);

      if (result.success) {
        toast.success(isEdit ? "학생 정보가 수정되었습니다" : "학생이 등록되었습니다");
        onOpenChange(false);
        form.reset();
        router.refresh();
      } else {
        toast.error(result.error || "오류가 발생했습니다");
      }
    });
  };

  const selectCls = "w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "학생 수정" : "학생 등록"}</DialogTitle>
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
                    <Input placeholder="학생 이름" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="school"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>학교</FormLabel>
                    <FormControl>
                      <Input placeholder="예: OO중학교" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="grade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>학년</FormLabel>
                    <FormControl>
                      <select
                        value={field.value ?? ""}
                        onChange={(e) => {
                          field.onChange(e.target.value);
                          // 학년 변경 시 배정반 초기화 + 다른 학년 override 해제
                          form.setValue("assigned_class", "");
                          setClassGradeOverride(null);
                        }}
                        className={selectCls}
                      >
                        <option value="">선택</option>
                        {GRADES.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="assigned_class"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between gap-2">
                      <FormLabel className="flex items-center gap-1.5">
                        배정반
                        {classGradeOverride && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">
                            {classGradeOverride} 반 목록
                          </span>
                        )}
                      </FormLabel>
                      {classGradeOverride ? (
                        <button
                          type="button"
                          onClick={() => {
                            setClassGradeOverride(null);
                            form.setValue("assigned_class", "");
                          }}
                          className="text-[10px] font-semibold text-slate-400 hover:text-slate-600"
                        >
                          원래 학년으로
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setClassGradeOverride(selectedGrade || GRADES[0]);
                            form.setValue("assigned_class", "");
                          }}
                          className="text-[10px] font-semibold text-blue-500 hover:text-blue-700"
                        >
                          다른 학년 반
                        </button>
                      )}
                    </div>
                    {classGradeOverride && (
                      <select
                        value={classGradeOverride}
                        onChange={(e) => {
                          setClassGradeOverride(e.target.value);
                          form.setValue("assigned_class", "");
                        }}
                        className={`${selectCls} mb-1.5`}
                      >
                        {GRADES.map((g) => (
                          <option key={g} value={g}>{g} 반</option>
                        ))}
                      </select>
                    )}
                    <FormControl>
                      <select
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        className={selectCls}
                      >
                        <option value="">선택</option>
                        {filteredClasses.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="teacher"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>담임선생님</FormLabel>
                    <FormControl>
                      <select
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        className={selectCls}
                      >
                        <option value="">선택</option>
                        {/* 담임 = 티칭 선생님만 (클리닉 제외) */}
                        {teachers.filter((t) => t.role !== "clinic").map((t) => (
                          <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="student_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>학생 연락처</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="01000000000"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const d = e.target.value.replace(/\D/g, "");
                          let f = d;
                          if (d.length > 3 && d.length <= 7) f = `${d.slice(0, 3)}-${d.slice(3)}`;
                          else if (d.length > 7) f = `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
                          field.onChange(f);
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parent_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>학부모 연락처</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="01000000000"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const d = e.target.value.replace(/\D/g, "");
                          let f = d;
                          if (d.length > 3 && d.length <= 7) f = `${d.slice(0, 3)}-${d.slice(3)}`;
                          else if (d.length > 7) f = `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
                          field.onChange(f);
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="registration_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>등록일</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="memo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>메모</FormLabel>
                    <FormControl>
                      <Input placeholder="특이사항 등" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

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
