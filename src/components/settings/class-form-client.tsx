"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  classFormSchema,
  type ClassFormValues,
} from "@/lib/validations/class";
import { createClass, updateClass } from "@/lib/actions/settings";
import type { Class, Teacher } from "@/types";
import { LOCATIONS } from "@/types";

// 30분 단위 시간 옵션 생성
const TIME_OPTIONS: string[] = [];
for (let h = 9; h <= 22; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 22) TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:30`);
}
TIME_OPTIONS.push("22:30", "23:00");

const ALL_DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

const PERIOD_PRESETS = [
  { label: "0교시", start: "16:00", end: "17:30" },
  { label: "1교시", start: "17:30", end: "19:00" },
  { label: "2교시", start: "19:00", end: "20:30" },
  { label: "3교시", start: "20:30", end: "22:00" },
] as const;

interface ScheduleSet {
  days: string[];
  hasClass: boolean;
  classStart: string;
  classEnd: string;
  hasClinic: boolean;
  clinicStart: string;
  clinicEnd: string;
  hasTest: boolean;
  testStart: string;
  testEnd: string;
}

function emptySet(): ScheduleSet {
  return {
    days: [],
    hasClass: true, classStart: "19:00", classEnd: "20:30",
    hasClinic: true, clinicStart: "20:30", clinicEnd: "22:00",
    hasTest: false, testStart: "16:00", testEnd: "17:30",
  };
}

function parseSets(cls?: Class): ScheduleSet[] {
  if (!cls?.class_days) return [emptySet()];
  const dayParts = cls.class_days.split("|").map((s) => s.trim());
  const timeParts = (cls.class_time || "").split("|").map((s) => s.trim());
  const clinicParts = (cls.clinic_time || "").split("|").map((s) => s.trim());
  const testParts = (cls.weekly_test_time || "").split("|").map((s) => s.trim());

  return dayParts.map((dp, i) => {
    const days = dp.split("").filter((ch) => ALL_DAYS.includes(ch as typeof ALL_DAYS[number]));

    const classRaw = timeParts[i] || "";
    const clinicRaw = clinicParts[i] || "";
    const testRaw = testParts[i] || "";

    const hasClass = classRaw.includes("~");
    const hasClinic = clinicRaw.includes("~");
    const hasTest = testRaw.includes("~");

    const [cs, ce] = hasClass ? classRaw.split("~") : ["19:00", "20:30"];
    const [cl, cle] = hasClinic ? clinicRaw.split("~") : ["20:30", "22:00"];
    const [ts, te] = hasTest ? testRaw.split("~") : ["16:00", "17:30"];

    return {
      days,
      hasClass,
      classStart: cs || "19:00",
      classEnd: ce || "20:30",
      hasClinic,
      clinicStart: cl || "20:30",
      clinicEnd: cle || "22:00",
      hasTest,
      testStart: ts || "16:00",
      testEnd: te || "17:30",
    };
  });
}

function serializeSets(sets: ScheduleSet[]) {
  const valid = sets.filter((s) => s.days.length > 0);
  if (valid.length === 0) return { class_days: "", class_time: "", clinic_time: "", weekly_test_time: "" };
  return {
    class_days: valid.map((s) => s.days.join("")).join("|"),
    class_time: valid.map((s) => s.hasClass ? `${s.classStart}~${s.classEnd}` : "").join("|"),
    clinic_time: valid.map((s) => s.hasClinic ? `${s.clinicStart}~${s.clinicEnd}` : "").join("|"),
    weekly_test_time: valid.map((s) => s.hasTest ? `${s.testStart}~${s.testEnd}` : "").join("|"),
  };
}

/** 교시 프리셋 매칭 확인 */
function matchedPeriod(start: string, end: string): string | null {
  const found = PERIOD_PRESETS.find((p) => p.start === start && p.end === end);
  return found ? found.label : null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classData?: Class;
  teachers?: Teacher[];
}

export function ClassFormDialog({ open, onOpenChange, classData, teachers = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!classData;
  const [sets, setSets] = useState<ScheduleSet[]>(() => parseSets(classData));

  useEffect(() => {
    if (open) {
      setSets(parseSets(classData));
    }
  }, [open, classData]);

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema) as never,
    defaultValues: {
      name: classData?.name ?? "",
      teacher: classData?.teacher ?? "",
      target_grade: classData?.target_grade ?? "",
      class_days: classData?.class_days ?? "",
      class_time: classData?.class_time ?? "",
      clinic_time: classData?.clinic_time ?? "",
      weekly_test_time: classData?.weekly_test_time ?? "",
      location: classData?.location ?? "",
    },
  });

  useEffect(() => {
    if (open && classData) {
      form.reset({
        name: classData.name ?? "",
        teacher: classData.teacher ?? "",
        target_grade: classData.target_grade ?? "",
        class_days: classData.class_days ?? "",
        class_time: classData.class_time ?? "",
        clinic_time: classData.clinic_time ?? "",
        weekly_test_time: classData.weekly_test_time ?? "",
        location: classData.location ?? "",
      });
    } else if (open) {
      form.reset({ name: "", teacher: "", target_grade: "", class_days: "", class_time: "", clinic_time: "", weekly_test_time: "", location: "" });
    }
  }, [open, classData, form]);

  const toggleDay = (setIdx: number, day: string) => {
    setSets((prev) =>
      prev.map((s, i) =>
        i === setIdx
          ? {
              ...s,
              days: s.days.includes(day)
                ? s.days.filter((d) => d !== day)
                : [...s.days, day].sort(
                    (a, b) => ALL_DAYS.indexOf(a as typeof ALL_DAYS[number]) - ALL_DAYS.indexOf(b as typeof ALL_DAYS[number])
                  ),
            }
          : s
      )
    );
  };

  const updateSet = (setIdx: number, updates: Partial<ScheduleSet>) => {
    setSets((prev) =>
      prev.map((s, i) => (i === setIdx ? { ...s, ...updates } : s))
    );
  };

  const addSet = () => setSets((prev) => [...prev, emptySet()]);
  const removeSet = (idx: number) => setSets((prev) => prev.filter((_, i) => i !== idx));

  const onSubmit = (values: ClassFormValues) => {
    const serialized = serializeSets(sets);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", values.name);
      formData.set("teacher", values.teacher || "");
      formData.set("target_grade", values.target_grade || "");
      formData.set("class_days", serialized.class_days);
      formData.set("class_time", serialized.class_time);
      formData.set("clinic_time", serialized.clinic_time);
      formData.set("weekly_test_time", serialized.weekly_test_time);
      formData.set("location", values.location || "");

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

  /** 시간 섹션 렌더 (수업/클리닉/주간테스트 공통) */
  const renderTimeSection = (
    idx: number,
    set: ScheduleSet,
    label: string,
    enabledKey: "hasClass" | "hasClinic" | "hasTest",
    startKey: "classStart" | "clinicStart" | "testStart",
    endKey: "classEnd" | "clinicEnd" | "testEnd",
  ) => {
    const enabled = set[enabledKey];
    const start = set[startKey];
    const end = set[endKey];
    const period = matchedPeriod(start, end);

    return (
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => updateSet(idx, { [enabledKey]: e.target.checked })}
              className="w-3.5 h-3.5 rounded accent-slate-800"
            />
            <span className="text-xs font-semibold text-slate-600">{label}</span>
          </label>
          {enabled && (
            <div className="flex gap-1 ml-1">
              {PERIOD_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => updateSet(idx, { [startKey]: p.start, [endKey]: p.end })}
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium transition-colors ${
                    period === p.label
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {enabled && (
          <div className="grid grid-cols-2 gap-3 ml-5">
            <Select
              value={start}
              onValueChange={(v) => updateSet(idx, { [startKey]: v })}
            >
              <SelectTrigger className="h-8 text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {TIME_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={end}
              onValueChange={(v) => updateSet(idx, { [endKey]: v })}
            >
              <SelectTrigger className="h-8 text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {TIME_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "반 수정" : "반 등록"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 기본 정보 */}
            <div className="grid grid-cols-3 gap-3">
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
                      <select
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">선택</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                      </select>
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
            </div>

            {/* 장소 */}
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>장소</FormLabel>
                  <FormControl>
                    <select
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">선택</option>
                      {LOCATIONS.map((loc) => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </FormControl>
                </FormItem>
              )}
            />

            {/* 시간표 세트 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700">시간표</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs rounded-lg"
                  onClick={addSet}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  세트 추가
                </Button>
              </div>

              {sets.map((set, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      세트 {idx + 1}
                    </span>
                    {sets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSet(idx)}
                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* 요일 선택 */}
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                      요일
                    </label>
                    <div className="flex gap-1.5">
                      {ALL_DAYS.map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(idx, day)}
                          className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${
                            set.days.includes(day)
                              ? "bg-slate-800 text-white shadow-sm"
                              : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400"
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 수업 / 클리닉 / 주간 테스트 - 각각 토글 + 교시 프리셋 */}
                  {renderTimeSection(idx, set, "수업", "hasClass", "classStart", "classEnd")}
                  {renderTimeSection(idx, set, "클리닉", "hasClinic", "clinicStart", "clinicEnd")}
                  {renderTimeSection(idx, set, "주간 테스트", "hasTest", "testStart", "testEnd")}

                  {/* 세트 요약 */}
                  {set.days.length > 0 && (set.hasClass || set.hasClinic || set.hasTest) && (
                    <div className="text-xs text-slate-500 bg-white rounded-lg px-3 py-2 border border-slate-100">
                      <span className="font-semibold text-slate-700">{set.days.join("")}</span>
                      {set.hasClass && <>{" "}수업 {set.classStart}~{set.classEnd}</>}
                      {set.hasClinic && <>{set.hasClass ? " /" : ""} 클리닉 {set.clinicStart}~{set.clinicEnd}</>}
                      {set.hasTest && <>{(set.hasClass || set.hasClinic) ? " /" : ""} 주간테스트 {set.testStart}~{set.testEnd}</>}
                    </div>
                  )}
                </div>
              ))}
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
