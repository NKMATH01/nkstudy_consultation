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
import { Textarea } from "@/components/ui/textarea";
import {
  registrationAdminSchema,
  type RegistrationAdminFormData,
} from "@/lib/validations/registration";
import type { Class, Teacher } from "@/types";
import { GRADES, LOCATIONS, SUBJECTS, getTuitionWithDiscount } from "@/types";

const WEEKDAYS: string[] = ["월", "화", "수", "목", "금", "토"];

// 30분 단위 시간 옵션
const TIME_OPTIONS = [
  "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00", "22:30",
];

const sel = "w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: RegistrationAdminFormData) => Promise<void>;
  grade?: string | null;
  classes: Class[];
  teachers: Teacher[];
}

function TimeRangeSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const parts = value ? value.split("~") : ["", ""];
  const startTime = parts[0] || "";
  const endTime = parts[1] || "";

  const handleChange = (type: "start" | "end", val: string) => {
    const s = type === "start" ? val : startTime;
    const e = type === "end" ? val : endTime;
    onChange(s && e ? `${s}~${e}` : s || e || "");
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label} *</label>
      <div className="flex items-center gap-2">
        <select value={startTime} onChange={(e) => handleChange("start", e.target.value)} className={sel}>
          <option value="">시작</option>
          {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-slate-400 font-bold">~</span>
        <select value={endTime} onChange={(e) => handleChange("end", e.target.value)} className={sel}>
          <option value="">종료</option>
          {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    </div>
  );
}

function DayCheckboxes({
  value,
  onChange,
  label,
  color = "blue",
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  color?: "blue" | "purple";
}) {
  const selected = WEEKDAYS.filter((d) => (value || "").includes(d));

  const toggle = (day: string) => {
    const next = selected.includes(day)
      ? selected.filter((d) => d !== day)
      : [...selected, day];
    const sorted = WEEKDAYS.filter((d) => next.includes(d));
    onChange(sorted.join(""));
  };

  const bg = color === "purple" ? "bg-purple-500 border-purple-500" : "bg-blue-500 border-blue-500";
  const hover = color === "purple" ? "hover:border-purple-300" : "hover:border-blue-300";

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label} *</label>
      <div className="flex gap-1.5">
        {WEEKDAYS.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            className={`w-9 h-9 rounded-md text-sm font-semibold border transition-colors ${
              selected.includes(day)
                ? `${bg} text-white`
                : `bg-white text-slate-500 border-slate-200 ${hover}`
            }`}
          >
            {day}
          </button>
        ))}
      </div>
    </div>
  );
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
  const [customEngClass, setCustomEngClass] = useState(false);
  const [customEngTeacher, setCustomEngTeacher] = useState(false);

  // 이름 중복 제거
  const uniqueTeachers = useMemo(() => {
    const seen = new Set<string>();
    return teachers.filter((t) => {
      if (seen.has(t.name)) return false;
      seen.add(t.name);
      return true;
    });
  }, [teachers]);

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
      math_class_days: "",
      math_class_time: "",
      math_clinic_time: "",
      assigned_class_2: "",
      teacher_2: "",
      eng_class_days: "",
      eng_class_time: "",
      eng_clinic_time: "",
      math_test_days: "",
      math_test_time: "",
      eng_test_days: "",
      eng_test_time: "",
      use_vehicle: "미사용",
      test_score: "",
      test_note: "",
      school_score: "",
      location: "",
      consult_date: "",
      additional_note: "",
      tuition_fee: defaultTuition,
    },
  });

  const selectedGrade = form.watch("grade");
  const selectedSubject = form.watch("subject");
  const hasEnglish = selectedSubject === "영어수학" || selectedSubject === "영어";
  const hasMath = selectedSubject === "영어수학" || selectedSubject === "수학";
  const isDoubleSubject = selectedSubject === "영어수학";

  const filteredClasses = useMemo(() => {
    if (!selectedGrade) return classes;
    const matched = classes.filter((c) =>
      c.target_grade === selectedGrade || c.name.startsWith(selectedGrade)
    );
    return matched.length > 0 ? matched : classes;
  }, [classes, selectedGrade]);

  const autoCalcFee = (g: string, s: string) => {
    if (!manualFee) {
      form.setValue("tuition_fee", getTuitionWithDiscount(g, s));
    }
  };

  const handleGradeChange = (value: string) => {
    form.setValue("grade", value);
    form.setValue("assigned_class", "");
    form.setValue("teacher", "");
    form.setValue("assigned_class_2", "");
    form.setValue("teacher_2", "");
    autoCalcFee(value, selectedSubject || "");
  };

  /** 반 스케줄(파이프 구분)에서 수업일/테스트일/시간을 분리 */
  const parseClassSchedule = (cls: Class) => {
    const daysSets = (cls.class_days || "").split("|");
    const timeSets = (cls.class_time || "").split("|");
    const clinicSets = (cls.clinic_time || "").split("|");
    const testSets = (cls.weekly_test_time || "").split("|");

    let classDaysStr = "";
    let testDaysStr = "";
    daysSets.forEach((days, i) => {
      if (timeSets[i]?.includes("~")) classDaysStr += days;
      if (testSets[i]?.includes("~")) testDaysStr += days;
    });

    return {
      classDays: WEEKDAYS.filter((d) => classDaysStr.includes(d)).join(""),
      classTime: timeSets.find((t) => t.includes("~")) || "",
      clinicTime: clinicSets.find((t) => t.includes("~")) || "",
      testDays: WEEKDAYS.filter((d) => testDaysStr.includes(d)).join(""),
      testTime: testSets.find((t) => t.includes("~")) || "",
      allDays: WEEKDAYS.filter((d) => (classDaysStr + testDaysStr).includes(d)).join(""),
    };
  };

  const updatePreferredDays = (mathAllDays?: string, engAllDays?: string) => {
    const allDays = new Set<string>();
    for (const d of (mathAllDays || "")) allDays.add(d);
    for (const d of (engAllDays || "")) allDays.add(d);
    const sorted = WEEKDAYS.filter((d) => allDays.has(d));
    form.setValue("preferred_days", sorted.join(""));
  };

  const handleSubjectChange = (value: string) => {
    form.setValue("subject", value);
    autoCalcFee(selectedGrade || "", value);
  };

  const handleClassChange = (value: string) => {
    form.setValue("assigned_class", value);
    const selectedClass = classes.find((c) => c.name === value);
    if (selectedClass) {
      if (selectedClass.teacher) form.setValue("teacher", selectedClass.teacher);
      const sch = parseClassSchedule(selectedClass);
      if (sch.classDays) form.setValue("math_class_days", sch.classDays);
      if (sch.classTime) form.setValue("math_class_time", sch.classTime);
      if (sch.clinicTime) form.setValue("math_clinic_time", sch.clinicTime);
      form.setValue("math_test_days", sch.testDays);
      form.setValue("math_test_time", sch.testTime);
      updatePreferredDays(sch.allDays, form.getValues("eng_class_days") || "");
      if (selectedClass.location) form.setValue("location", selectedClass.location);
    }
  };

  const handleClass2Change = (value: string) => {
    if (value === "__custom__") {
      setCustomEngClass(true);
      form.setValue("assigned_class_2", "");
      return;
    }
    setCustomEngClass(false);
    form.setValue("assigned_class_2", value);
    const selectedClass = classes.find((c) => c.name === value);
    if (selectedClass) {
      if (selectedClass.teacher) form.setValue("teacher_2", selectedClass.teacher);
      const sch = parseClassSchedule(selectedClass);
      if (sch.classDays) form.setValue("eng_class_days", sch.classDays);
      if (sch.classTime) form.setValue("eng_class_time", sch.classTime);
      if (sch.clinicTime) form.setValue("eng_clinic_time", sch.clinicTime);
      form.setValue("eng_test_days", sch.testDays);
      form.setValue("eng_test_time", sch.testTime);
      updatePreferredDays(form.getValues("math_class_days") || "", sch.allDays);
    }
  };

  const handleTeacher2Change = (value: string) => {
    if (value === "__custom__") {
      setCustomEngTeacher(true);
      form.setValue("teacher_2", "");
      return;
    }
    setCustomEngTeacher(false);
    form.setValue("teacher_2", value);
  };

  const handleSubmit = async (data: RegistrationAdminFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const mathLabel = isDoubleSubject ? "수학 배정반" : "배정반";
  const mathTeacherLabel = isDoubleSubject ? "수학 담임" : "담임";

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
                    <select
                      value={field.value || ""}
                      onChange={(e) => handleGradeChange(e.target.value)}
                      className={sel}
                    >
                      <option value="">학년 선택</option>
                      {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
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
                    <select
                      value={field.value || ""}
                      onChange={(e) => handleSubjectChange(e.target.value)}
                      className={sel}
                    >
                      <option value="">과목 선택</option>
                      {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* preferred_days (자동 계산, hidden) */}
            <input type="hidden" {...form.register("preferred_days")} />

            {/* 수학 배정반 + 담임 + 요일 */}
            {hasMath && (
              <>
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs font-bold text-blue-600 mb-3">수학</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="assigned_class"
                    render={() => (
                      <FormItem>
                        <FormLabel>{mathLabel} *</FormLabel>
                        <select
                          value={form.watch("assigned_class") || ""}
                          onChange={(e) => handleClassChange(e.target.value)}
                          className={sel}
                        >
                          <option value="">반 선택</option>
                          {filteredClasses.map((c) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="teacher"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{mathTeacherLabel} *</FormLabel>
                        <select
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          className={sel}
                        >
                          <option value="">선생님 선택</option>
                          {uniqueTeachers.map((t) => (
                            <option key={t.id} value={t.name}>{t.name}</option>
                          ))}
                        </select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="math_class_days"
                  render={({ field }) => (
                    <FormItem>
                      <DayCheckboxes
                        label="수학 수업 요일"
                        color="blue"
                        value={field.value || ""}
                        onChange={(v) => {
                          field.onChange(v);
                          updatePreferredDays(v, form.getValues("eng_class_days") || "");
                        }}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="math_class_time"
                    render={({ field }) => (
                      <TimeRangeSelect
                        label="수학 수업 시간"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="math_clinic_time"
                    render={({ field }) => (
                      <TimeRangeSelect
                        label="수학 클리닉 시간"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
                {/* 주간테스트 (자동입력, 있을때만 표시) */}
                {(form.watch("math_test_days") || form.watch("math_test_time")) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-amber-700 mb-1.5">주간 테스트</p>
                    <div className="flex items-center gap-3 text-sm text-amber-900">
                      <span className="font-semibold">{form.watch("math_test_days") || "-"}</span>
                      <span className="text-amber-400">|</span>
                      <span>{form.watch("math_test_time") || "-"}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 영어 배정반 + 담임 + 요일 */}
            {hasEnglish && (
              <>
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs font-bold text-purple-600 mb-3">영어</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="assigned_class_2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>영어 배정반 *</FormLabel>
                        {customEngClass ? (
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                placeholder="영어반 이름 입력"
                                value={field.value || ""}
                                onChange={field.onChange}
                              />
                            </FormControl>
                            <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setCustomEngClass(false)}>
                              목록
                            </Button>
                          </div>
                        ) : (
                          <select
                            value={field.value || ""}
                            onChange={(e) => handleClass2Change(e.target.value)}
                            className={sel}
                          >
                            <option value="">영어반 선택</option>
                            {filteredClasses.map((c) => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                            <option value="__custom__">직접 입력...</option>
                          </select>
                        )}
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
                        {customEngTeacher ? (
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                placeholder="선생님 이름 입력"
                                value={field.value || ""}
                                onChange={field.onChange}
                              />
                            </FormControl>
                            <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setCustomEngTeacher(false)}>
                              목록
                            </Button>
                          </div>
                        ) : (
                          <select
                            value={field.value || ""}
                            onChange={(e) => handleTeacher2Change(e.target.value)}
                            className={sel}
                          >
                            <option value="">선생님 선택</option>
                            {uniqueTeachers.map((t) => (
                              <option key={t.id} value={t.name}>{t.name}</option>
                            ))}
                            <option value="__custom__">직접 입력...</option>
                          </select>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="eng_class_days"
                  render={({ field }) => (
                    <FormItem>
                      <DayCheckboxes
                        label="영어 수업 요일"
                        color="purple"
                        value={field.value || ""}
                        onChange={(v) => {
                          field.onChange(v);
                          updatePreferredDays(form.getValues("math_class_days") || "", v);
                        }}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="eng_class_time"
                    render={({ field }) => (
                      <TimeRangeSelect
                        label="영어 수업 시간"
                        value={field.value || ""}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="eng_clinic_time"
                    render={({ field }) => (
                      <TimeRangeSelect
                        label="영어 클리닉 시간"
                        value={field.value || ""}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
                {/* 영어 주간테스트 (자동입력, 있을때만 표시) */}
                {(form.watch("eng_test_days") || form.watch("eng_test_time")) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-amber-700 mb-1.5">주간 테스트</p>
                    <div className="flex items-center gap-3 text-sm text-amber-900">
                      <span className="font-semibold">{form.watch("eng_test_days") || "-"}</span>
                      <span className="text-amber-400">|</span>
                      <span>{form.watch("eng_test_time") || "-"}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 영어만 선택일 때 수학 필드 숨기기 위해 기본값 설정 */}
            {!hasMath && (
              <>
                <input type="hidden" {...form.register("assigned_class")} value="N/A" />
                <input type="hidden" {...form.register("teacher")} value="N/A" />
                <input type="hidden" {...form.register("math_class_time")} value="N/A" />
                <input type="hidden" {...form.register("math_clinic_time")} value="N/A" />
              </>
            )}

            {/* 차량/장소 */}
            <div className="border-t border-slate-100 pt-3">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="use_vehicle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>차량 이용</FormLabel>
                      <select
                        value={field.value || "미사용"}
                        onChange={(e) => field.onChange(e.target.value)}
                        className={sel}
                      >
                        <option value="미사용">미사용</option>
                        <option value="등원">등원</option>
                        <option value="하원">하원</option>
                        <option value="등하원">등하원</option>
                      </select>
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
                      <select
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value)}
                        className={sel}
                      >
                        <option value="">장소 선택</option>
                        {LOCATIONS.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
                      </select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 테스트/내신/상담 */}
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
                name="school_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>내신 점수</FormLabel>
                    <FormControl>
                      <Input placeholder="예: 수학 92점" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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

            <FormField
              control={form.control}
              name="test_note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>테스트 특이사항</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="테스트 관련 특이사항..." {...field} />
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
                    <Textarea rows={2} placeholder="추가 조치사항..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
