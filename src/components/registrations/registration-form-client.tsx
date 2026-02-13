"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  registrationAdminSchema,
  type RegistrationAdminFormData,
} from "@/lib/validations/registration";
import type { Class, Teacher } from "@/types";
import { GRADES, LOCATIONS, SUBJECTS, PREFERRED_DAYS, getTuitionWithDiscount } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: RegistrationAdminFormData) => Promise<void>;
  grade?: string | null;
  classes: Class[];
  teachers: Teacher[];
}

export function RegistrationForm({
  open,
  onOpenChange,
  onSubmit,
  grade,
  classes,
  teachers,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualFee, setManualFee] = useState(false);

  const defaultTuition = getTuitionWithDiscount(grade || "", "");

  const form = useForm<RegistrationAdminFormData>({
    resolver: zodResolver(registrationAdminSchema) as never,
    defaultValues: {
      registration_date: new Date().toISOString().slice(0, 10),
      grade: grade || "",
      subject: "",
      preferred_days: "",
      assigned_class: "",
      teacher: "",
      assigned_class_2: "",
      teacher_2: "",
      use_vehicle: "미사용",
      test_score: "",
      test_note: "",
      location: "",
      consult_date: "",
      additional_note: "",
      tuition_fee: defaultTuition,
    },
  });

  const selectedGrade = form.watch("grade");
  const selectedSubject = form.watch("subject");
  const isDoubleSubject = selectedSubject === "영어수학";

  // 학년에 맞는 반만 필터링 (반 이름에서 학년 접두사 추출: "중3L1" → "중3")
  const filteredClasses = useMemo(() => {
    if (!selectedGrade) return classes;
    return classes.filter(
      (c) => c.name.slice(0, 2) === selectedGrade
    );
  }, [classes, selectedGrade]);

  // 학년 또는 과목 변경 시 수업료 자동 계산
  const autoCalcFee = (g: string, s: string) => {
    if (!manualFee) {
      form.setValue("tuition_fee", getTuitionWithDiscount(g, s));
    }
  };

  // 학년 변경 시 반/담임 초기화
  const handleGradeChange = (value: string) => {
    form.setValue("grade", value);
    form.setValue("assigned_class", "");
    form.setValue("teacher", "");
    form.setValue("assigned_class_2", "");
    form.setValue("teacher_2", "");
    autoCalcFee(value, selectedSubject || "");
  };

  const handleSubjectChange = (value: string) => {
    form.setValue("subject", value);
    autoCalcFee(selectedGrade || "", value);
  };

  // 반 선택 시 담임 자동 배정
  const handleClassChange = (value: string) => {
    form.setValue("assigned_class", value);
    const selectedClass = classes.find((c) => c.name === value);
    if (selectedClass?.teacher) {
      form.setValue("teacher", selectedClass.teacher);
    }
  };

  // 영어반 선택 시 영어 담임 자동 배정
  const handleClass2Change = (value: string) => {
    form.setValue("assigned_class_2", value);
    const selectedClass = classes.find((c) => c.name === value);
    if (selectedClass?.teacher) {
      form.setValue("teacher_2", selectedClass.teacher);
    }
  };

  const handleSubmit = async (data: RegistrationAdminFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const subjectLabel = isDoubleSubject ? "수학 배정반" : "배정반";
  const teacherLabel = isDoubleSubject ? "수학 담임" : "담임";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>등록 안내문 생성</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* 등록일 + 수업료 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="registration_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>등록 예정일 *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tuition_fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      월 수업료
                      {manualFee ? (
                        <button
                          type="button"
                          className="text-[10px] text-blue-500 underline"
                          onClick={() => {
                            setManualFee(false);
                            autoCalcFee(selectedGrade || "", selectedSubject || "");
                          }}
                        >
                          자동계산
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-normal">자동</span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="350000"
                        {...field}
                        onChange={(e) => {
                          setManualFee(true);
                          field.onChange(e);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 학년 + 과목 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="grade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>학년 *</FormLabel>
                    <Select
                      onValueChange={handleGradeChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="학년 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GRADES.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>과목 *</FormLabel>
                    <Select onValueChange={handleSubjectChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="과목 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SUBJECTS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 희망요일 */}
            <FormField
              control={form.control}
              name="preferred_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>희망요일 *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="희망요일 선택" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PREFERRED_DAYS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 배정반 + 담임 (첫 번째 - 수학 or 기본) */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="assigned_class"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{subjectLabel} *</FormLabel>
                    <Select onValueChange={handleClassChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="반 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredClasses.map((c) => (
                          <SelectItem key={c.id} value={c.name}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="teacher"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{teacherLabel} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="선생님 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {teachers.map((t) => (
                          <SelectItem key={t.id} value={t.name}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 영어수학 선택 시 두 번째 반/담임 */}
            {isDoubleSubject && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="assigned_class_2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>영어 배정반 *</FormLabel>
                      <Select
                        onValueChange={handleClass2Change}
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="영어반 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredClasses.map((c) => (
                            <SelectItem key={c.id} value={c.name}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="teacher_2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>영어 담임 *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="선생님 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {teachers.map((t) => (
                            <SelectItem key={t.id} value={t.name}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* 차량/장소 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="use_vehicle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>차량 이용</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || "미사용"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="미사용">미사용</SelectItem>
                        <SelectItem value="등원">등원</SelectItem>
                        <SelectItem value="하원">하원</SelectItem>
                        <SelectItem value="등하원">등하원</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>수업 장소</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="장소 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LOCATIONS.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {loc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 테스트/상담 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="test_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>테스트 점수</FormLabel>
                    <FormControl>
                      <Input placeholder="예: 85점" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="consult_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>학부모 상담 예정일</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="test_note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>테스트 특이사항</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="테스트 관련 특이사항..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="additional_note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>추가 조치사항</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="추가 조치사항..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  "안내문 생성"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
