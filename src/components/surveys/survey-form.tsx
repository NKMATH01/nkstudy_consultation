"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
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
  surveyFormSchema,
  type SurveyFormValues,
} from "@/lib/validations/survey";
import { createSurvey } from "@/lib/actions/survey";
import { GRADES, SURVEY_QUESTIONS } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SCORE_OPTIONS = [1, 2, 3, 4, 5];

function ScoreButtons({
  control,
  fieldName,
  setValue,
}: {
  control: ReturnType<typeof useForm<SurveyFormValues>>["control"];
  fieldName: keyof SurveyFormValues;
  setValue: ReturnType<typeof useForm<SurveyFormValues>>["setValue"];
}) {
  const value = useWatch({ control, name: fieldName });
  return (
    <div className="flex gap-1 shrink-0">
      {SCORE_OPTIONS.map((score) => (
        <Button
          key={score}
          type="button"
          variant={value === score ? "default" : "outline"}
          size="sm"
          className="h-7 w-7 p-0 text-xs"
          onClick={() => setValue(fieldName, score as never)}
        >
          {score}
        </Button>
      ))}
    </div>
  );
}

export function SurveyFormDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<SurveyFormValues>({
    resolver: zodResolver(surveyFormSchema) as never,
    defaultValues: {
      name: "",
      school: "",
      grade: "",
      student_phone: "",
      parent_phone: "",
      referral: "",
      prev_academy: "",
      prev_complaint: "",
      study_core: "",
      problem_self: "",
      dream: "",
      prefer_days: "",
      requests: "",
    },
  });

  const onSubmit = (values: SurveyFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          formData.set(key, String(value));
        }
      });

      const result = await createSurvey(formData);

      if (result.success) {
        toast.success("설문이 등록되었습니다");
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>설문 등록</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* 기본 정보 */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">기본 정보</h4>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="학년" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {GRADES.map((g) => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
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
                  name="student_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>학생 연락처</FormLabel>
                      <FormControl>
                        <Input placeholder="010-0000-0000" {...field} />
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
                        <Input placeholder="010-0000-0000" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="referral"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>유입경로</FormLabel>
                      <FormControl>
                        <Input placeholder="예: 지인소개" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="prev_academy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>기존 학원</FormLabel>
                      <FormControl>
                        <Input placeholder="기존 학원명" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="prev_complaint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>기존 학원 아쉬운점</FormLabel>
                      <FormControl>
                        <Input placeholder="" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 30문항 */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                설문 응답 (1~5점)
              </h4>
              <div className="space-y-2">
                {SURVEY_QUESTIONS.map((question, idx) => {
                  const qNum = idx + 1;
                  const fieldName = `q${qNum}` as keyof SurveyFormValues;
                  return (
                    <div key={qNum} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-6 text-right shrink-0">
                        {qNum}.
                      </span>
                      <span className="text-sm flex-1 min-w-0">{question}</span>
                      <ScoreButtons
                        control={form.control}
                        fieldName={fieldName}
                        setValue={form.setValue}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 주관식 */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">주관식 답변</h4>
              <FormField
                control={form.control}
                name="study_core"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>공부의 핵심이 뭐라고 생각하나요?</FormLabel>
                    <FormControl>
                      <Textarea className="resize-none" rows={2} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="problem_self"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>본인의 학습 문제점은?</FormLabel>
                    <FormControl>
                      <Textarea className="resize-none" rows={2} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dream"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>희망 직업</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prefer_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>선호 요일</FormLabel>
                    <FormControl>
                      <Input placeholder="예: 월수금" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="requests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NK학원에 바라는 점</FormLabel>
                    <FormControl>
                      <Textarea className="resize-none" rows={2} {...field} />
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
                {isPending ? "저장 중..." : "등록"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
