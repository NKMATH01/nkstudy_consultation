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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  consultationFormSchema,
  type ConsultationFormValues,
} from "@/lib/validations/consultation";
import { createConsultation, updateConsultation } from "@/lib/actions/consultation";
import { GRADES, CONSULT_TYPES, LOCATIONS, PREFERRED_DAYS } from "@/types";
import type { Consultation } from "@/types";

const ADVANCE_LEVELS = ["없음", "1개월", "3개월", "6개월", "1년", "2년 이상"] as const;
const STUDY_GOALS = ["내신 향상", "선행 학습", "기초 보강", "상위권 유지", "수능 대비", "기타"] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultation?: Consultation;
  classes?: { id: string; name: string }[];
}

export function ConsultationFormDialog({
  open,
  onOpenChange,
  consultation,
  classes = [],
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!consultation;

  const form = useForm<ConsultationFormValues>({
    resolver: zodResolver(consultationFormSchema) as never,
    defaultValues: {
      name: consultation?.name ?? "",
      school: consultation?.school ?? "",
      grade: consultation?.grade ?? "",
      parent_phone: consultation?.parent_phone ?? "",
      consult_date: consultation?.consult_date ?? "",
      consult_time: consultation?.consult_time?.slice(0, 5) ?? "",
      subject: consultation?.subject ?? "",
      location: consultation?.location ?? "",
      consult_type: consultation?.consult_type ?? "유선 상담",
      memo: consultation?.memo ?? "",
      prev_academy: consultation?.prev_academy ?? "",
      prev_complaint: consultation?.prev_complaint ?? "",
      school_score: consultation?.school_score ?? "",
      test_score: consultation?.test_score ?? "",
      advance_level: consultation?.advance_level ?? "",
      study_goal: consultation?.study_goal ?? "",
      prefer_days: consultation?.prefer_days ?? "",
      plan_date: consultation?.plan_date ?? "",
      plan_class: consultation?.plan_class ?? "",
      requests: consultation?.requests ?? "",
      student_consult_note: consultation?.student_consult_note ?? "",
    },
  });

  const onSubmit = (values: ConsultationFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.set(key, String(value));
        }
      });

      const result = isEdit
        ? await updateConsultation(consultation!.id, formData)
        : await createConsultation(formData);

      if (result.success) {
        toast.success(isEdit ? "상담이 수정되었습니다" : "상담이 등록되었습니다");
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "상담 수정" : "상담 등록"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* 기본 정보 */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700 border-b pb-1">기본 정보</h4>
              <div className="grid grid-cols-3 gap-3">
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
                <FormField
                  control={form.control}
                  name="school"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>학교</FormLabel>
                      <FormControl>
                        <Input placeholder="학교명" {...field} />
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
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="학년" />
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
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="parent_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>학부모 연락처</FormLabel>
                    <FormControl>
                      <Input placeholder="010-0000-0000" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* 상담 일정 */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700 border-b pb-1">상담 일정</h4>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="consult_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>날짜</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="consult_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>시간</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="consult_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>상담방식</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CONSULT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>과목</FormLabel>
                      <FormControl>
                        <select
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          className={selectCls}
                        >
                          <option value="">선택</option>
                          <option value="수학">수학</option>
                          <option value="영어">영어</option>
                          <option value="영어수학">영어수학</option>
                        </select>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>장소</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="장소 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {LOCATIONS.map((l) => (
                            <SelectItem key={l} value={l}>
                              {l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 상담기록지 */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700 border-b pb-1">상담 기록지</h4>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="prev_academy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>기존 학원 정보</FormLabel>
                      <FormControl>
                        <Input placeholder="이전 학원명" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="prev_complaint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>불만사항</FormLabel>
                      <FormControl>
                        <Input placeholder="기존 학원 불만사항" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="school_score"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>내신 점수</FormLabel>
                      <FormControl>
                        <Input placeholder="예: 85점, 3등급" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="test_score"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>테스트 점수</FormLabel>
                      <FormControl>
                        <Input placeholder="테스트 결과" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="advance_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>선행 정도</FormLabel>
                      <FormControl>
                        <select
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          className={selectCls}
                        >
                          <option value="">선택</option>
                          {ADVANCE_LEVELS.map((l) => (
                            <option key={l} value={l}>{l}</option>
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
                  name="study_goal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>학습 목표</FormLabel>
                      <FormControl>
                        <select
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          className={selectCls}
                        >
                          <option value="">선택</option>
                          {STUDY_GOALS.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="prefer_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>희망 요일</FormLabel>
                      <FormControl>
                        <select
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          className={selectCls}
                        >
                          <option value="">선택</option>
                          {PREFERRED_DAYS.map((d) => (
                            <option key={d} value={d}>{d}</option>
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
                  name="plan_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>등록 예정일</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="plan_class"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>등록 예정반</FormLabel>
                      <FormControl>
                        <select
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          className={selectCls}
                        >
                          <option value="">선택</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="requests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>학원에 바라는 점</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="학부모님이 학원에 바라는 점"
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="student_consult_note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>특이사항</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="학생 관련 특이사항"
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* 메모 */}
            <FormField
              control={form.control}
              name="memo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>메모</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="추가 메모 사항"
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
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
