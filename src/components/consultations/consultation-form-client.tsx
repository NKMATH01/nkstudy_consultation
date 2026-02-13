"use client";

import { useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { User, CalendarDays, ClipboardList, MessageSquare } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  consultationFormSchema,
  type ConsultationFormValues,
} from "@/lib/validations/consultation";
import { createConsultation, updateConsultation } from "@/lib/actions/consultation";
import { GRADES, LOCATIONS, PREFERRED_DAYS } from "@/types";
import type { Consultation } from "@/types";

const ADVANCE_LEVELS = ["없음", "1개월", "3개월", "6개월", "1년", "2년 이상"] as const;
const STUDY_GOALS = ["내신 향상", "선행 학습", "기초 보강", "상위권 유지", "수능 대비", "기타"] as const;

const sel = "w-full h-9 rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-colors";
const inp = "rounded-lg border-slate-200 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-colors";

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

  const emptyValues: ConsultationFormValues = {
    name: "", school: "", grade: "", parent_phone: "",
    consult_date: "", consult_time: "", subject: "", location: "",
    consult_type: "유선", memo: "",
    prev_academy: "", prev_complaint: "", school_score: "", test_score: "",
    advance_level: "", study_goal: "", prefer_days: "",
    plan_date: "", plan_class: "", requests: "", student_consult_note: "",
  };

  const form = useForm<ConsultationFormValues>({
    resolver: zodResolver(consultationFormSchema) as never,
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    if (consultation) {
      form.reset({
        name: consultation.name ?? "",
        school: consultation.school ?? "",
        grade: consultation.grade ?? "",
        parent_phone: consultation.parent_phone ?? "",
        consult_date: consultation.consult_date ?? "",
        consult_time: consultation.consult_time?.slice(0, 5) ?? "",
        subject: consultation.subject ?? "",
        location: consultation.location ?? "",
        consult_type: consultation.consult_type ?? "유선",
        memo: consultation.memo ?? "",
        prev_academy: consultation.prev_academy ?? "",
        prev_complaint: consultation.prev_complaint ?? "",
        school_score: consultation.school_score ?? "",
        test_score: consultation.test_score ?? "",
        advance_level: consultation.advance_level ?? "",
        study_goal: consultation.study_goal ?? "",
        prefer_days: consultation.prefer_days ?? "",
        plan_date: consultation.plan_date ?? "",
        plan_class: consultation.plan_class ?? "",
        requests: consultation.requests ?? "",
        student_consult_note: consultation.student_consult_note ?? "",
      });
    } else {
      form.reset(emptyValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, consultation]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="sticky top-0 z-10 bg-white px-6 pt-5 pb-4 border-b border-slate-100">
          <DialogTitle className="text-lg font-bold text-slate-800">
            {isEdit ? "상담 수정" : "새 상담 등록"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="px-6 py-5 space-y-6">

            {/* ── 기본 정보 ── */}
            <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <User className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-bold text-slate-700">기본 정보</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">이름 *</FormLabel>
                    <FormControl><Input className={inp} placeholder="학생 이름" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="school" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">학교</FormLabel>
                    <FormControl><Input className={inp} placeholder="학교명" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="grade" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">학년</FormLabel>
                    <FormControl>
                      <select value={field.value ?? ""} onChange={field.onChange} className={sel}>
                        <option value="">선택</option>
                        {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="parent_phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">학부모 연락처</FormLabel>
                    <FormControl><Input className={inp} placeholder="010-0000-0000" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
            </section>

            {/* ── 상담 일정 ── */}
            <section className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-bold text-slate-700">상담 일정</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <FormField control={form.control} name="consult_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">날짜</FormLabel>
                    <FormControl><Input type="date" className={inp} {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="consult_time" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">시간</FormLabel>
                    <FormControl><Input type="time" className={inp} {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="consult_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">상담방식</FormLabel>
                    <FormControl>
                      <Input className={inp} placeholder="유선, 대면 14:00" {...field} />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">장소</FormLabel>
                    <FormControl>
                      <select value={field.value ?? ""} onChange={field.onChange} className={sel}>
                        <option value="">선택</option>
                        {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </FormControl>
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="subject" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">테스트 과목</FormLabel>
                    <FormControl>
                      <select value={field.value ?? ""} onChange={field.onChange} className={sel}>
                        <option value="">선택</option>
                        <option value="수학">수학</option>
                        <option value="영어">영어</option>
                        <option value="영어수학">영어수학</option>
                      </select>
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="memo" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">메모</FormLabel>
                    <FormControl><Input className={inp} placeholder="간단 메모" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
            </section>

            {/* ── 상담 기록지 ── */}
            <section className="rounded-xl border border-amber-100 bg-amber-50/30 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-bold text-slate-700">상담 기록지</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="prev_academy" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">기존 학원</FormLabel>
                    <FormControl><Input className={inp} placeholder="이전 학원명" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="prev_complaint" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">불만사항</FormLabel>
                    <FormControl><Input className={inp} placeholder="기존 학원 불만" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="school_score" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">내신 점수</FormLabel>
                    <FormControl><Input className={inp} placeholder="85점 / 3등급" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="test_score" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">테스트 점수</FormLabel>
                    <FormControl><Input className={inp} placeholder="테스트 결과" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="advance_level" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">선행 정도</FormLabel>
                    <FormControl>
                      <select value={field.value ?? ""} onChange={field.onChange} className={sel}>
                        <option value="">선택</option>
                        {ADVANCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </FormControl>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="study_goal" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">학습 목표</FormLabel>
                    <FormControl>
                      <select value={field.value ?? ""} onChange={field.onChange} className={sel}>
                        <option value="">선택</option>
                        {STUDY_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="prefer_days" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">희망 요일</FormLabel>
                    <FormControl>
                      <select value={field.value ?? ""} onChange={field.onChange} className={sel}>
                        <option value="">선택</option>
                        {PREFERRED_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </FormControl>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="plan_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">등록 예정일</FormLabel>
                    <FormControl><Input type="date" className={inp} {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="plan_class" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-500">등록 예정반</FormLabel>
                    <FormControl>
                      <select value={field.value ?? ""} onChange={field.onChange} className={sel}>
                        <option value="">선택</option>
                        {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </FormControl>
                  </FormItem>
                )} />
              </div>
            </section>

            {/* ── 특이사항 ── */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-700">상세 메모</span>
              </div>
              <FormField control={form.control} name="requests" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-slate-500">학원에 바라는 점</FormLabel>
                  <FormControl>
                    <Textarea className={`resize-none ${inp}`} rows={2} placeholder="학부모님이 학원에 바라는 점" {...field} />
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="student_consult_note" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-slate-500">특이사항</FormLabel>
                  <FormControl>
                    <Textarea className={`resize-none ${inp}`} rows={2} placeholder="학생 관련 특이사항" {...field} />
                  </FormControl>
                </FormItem>
              )} />
            </section>

            {/* ── 버튼 ── */}
            <div className="sticky bottom-0 bg-white border-t border-slate-100 -mx-6 px-6 py-4 flex justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-lg" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="rounded-lg text-white font-semibold px-6"
                style={{ background: "#0F2B5B" }}
              >
                {isPending ? "저장 중..." : isEdit ? "수정" : "등록"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
