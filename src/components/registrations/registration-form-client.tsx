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
    // target_grade 또는 반 이름 앞 2글자로 학년 매칭
    return classes.filter((c) =>
      c.target_grade === selectedGrade || c.name.startsWith(selectedGrade)
    );
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

  const updatePreferredDays = (mathDays?: string, engDays?: string) => {
    const allDays = new Set<string>();
    for (const d of (mathDays || "")) allDays.add(d);
    for (const d of (engDays || "")) allDays.add(d);
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
    if (selectedClass?.teacher) {
      form.setValue("teacher", selectedClass.teacher);
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
    if (selectedClass?.teacher) {
      form.setValue("teacher_2", selectedClass.teacher);
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
                    <Select onValueChange={handleGradeChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="학년 선택" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
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
                        <SelectTrigger><SelectValue placeholder="과목 선택" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{mathLabel} *</FormLabel>
                        <Select onValueChange={handleClassChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="반 선택" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredClasses.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
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
                        <FormLabel>{mathTeacherLabel} *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="선생님 선택" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {uniqueTeachers.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
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
                          <Select onValueChange={handleClass2Change} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="영어반 선택" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {filteredClasses.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                              <SelectItem value="__custom__">직접 입력...</SelectItem>
                            </SelectContent>
                          </Select>
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
                          <Select onValueChange={handleTeacher2Change} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="선생님 선택" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {uniqueTeachers.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                              <SelectItem value="__custom__">직접 입력...</SelectItem>
                            </SelectContent>
                          </Select>
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
                      <Select onValueChange={field.onChange} value={field.value || "미사용"}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
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
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="장소 선택" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {LOCATIONS.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                        </SelectContent>
                      </Select>
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
