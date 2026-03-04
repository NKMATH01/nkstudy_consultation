"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, MessageSquare, Save } from "lucide-react";
import { toast } from "sonner";
import { updateConsultationField } from "@/lib/actions/consultation";
import type { Consultation, Survey } from "@/types";
import { SURVEY_QUESTIONS, FACTOR_LABELS, PREFERRED_DAYS } from "@/types";

const ADVANCE_LEVELS = ["없음", "1개월", "3개월", "6개월", "1년", "2년 이상"] as const;
const STUDY_GOALS = ["내신 향상", "선행 학습", "기초 보강", "상위권 유지", "수능 대비", "기타"] as const;

const FACTOR_COLORS: Record<string, { bar: string; text: string }> = {
  attitude: { bar: "bg-blue-500", text: "text-blue-600" },
  self_directed: { bar: "bg-violet-500", text: "text-violet-600" },
  assignment: { bar: "bg-emerald-500", text: "text-emerald-600" },
  willingness: { bar: "bg-amber-500", text: "text-amber-600" },
  social: { bar: "bg-pink-500", text: "text-pink-600" },
  management: { bar: "bg-red-500", text: "text-red-600" },
  emotion: { bar: "bg-cyan-500", text: "text-cyan-600" },
};
const BASE_FACTOR_KEYS = ["attitude", "self_directed", "assignment", "willingness", "social", "management"] as const;

const sel = "w-full h-9 rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-colors";
const inp = "rounded-lg border-slate-200 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-colors";

interface Props {
  survey: Survey;
  consultation: Consultation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes?: { id: string; name: string }[];
}

export function ConsultationRecordDialog({ survey, consultation, open, onOpenChange, classes = [] }: Props) {
  const [form, setForm] = useState(() => ({
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
    parent_consult_note: consultation.parent_consult_note ?? "",
  }));
  const [saving, setSaving] = useState<string | null>(null);

  const saveField = useCallback(async (field: string, value: string) => {
    setSaving(field);
    try {
      const result = await updateConsultationField(consultation.id, field, value);
      if (result.success) {
        toast.success("저장되었습니다");
      } else {
        toast.error(result.error || "저장 실패");
      }
    } finally {
      setSaving(null);
    }
  }, [consultation.id]);

  const handleBlur = (field: string) => {
    const value = form[field as keyof typeof form];
    const original = (consultation[field as keyof Consultation] as string) ?? "";
    if (value !== original) {
      saveField(field, value);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    saveField(field, value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-100">
          <DialogTitle className="text-lg font-extrabold" style={{ color: "#0F172A" }}>
            {survey.name} - 상담 기록지
          </DialogTitle>
          <p className="text-xs text-slate-500">
            {[survey.school, survey.grade].filter(Boolean).join(" ")}
            {survey.created_at && ` | 설문일: ${new Date(survey.created_at).toLocaleDateString("ko-KR")}`}
          </p>
        </DialogHeader>

        <div className="flex overflow-hidden" style={{ height: "calc(90vh - 80px)" }}>
          {/* LEFT: Survey Preview (read-only) */}
          <div className="w-1/2 border-r border-slate-100 overflow-y-auto p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
              <ClipboardList className="h-4 w-4 text-blue-600" />
              설문 응답
            </h3>

            {/* 7-Factor */}
            <div className="p-3 rounded-xl bg-slate-50">
              <h4 className="text-xs font-bold text-slate-700 mb-2.5">7-Factor 학습 성향</h4>
              <div className="space-y-2">
                {(survey.factor_emotion != null ? [...BASE_FACTOR_KEYS, "emotion" as const] : BASE_FACTOR_KEYS).map((key) => {
                  const v = (survey[`factor_${key}` as keyof Survey] as number | null) ?? 0;
                  const pct = (v / 5) * 100;
                  const colors = FACTOR_COLORS[key];
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-semibold text-slate-600">{FACTOR_LABELS[key]}</span>
                        <span className={`text-[11px] font-bold ${colors.text}`}>{v.toFixed(1)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full ${colors.bar} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 35문항 */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">설문 응답 ({SURVEY_QUESTIONS.length}문항)</h4>
              <div className="space-y-0.5 max-h-[400px] overflow-y-auto pr-1">
                {SURVEY_QUESTIONS.map((q, idx) => {
                  const qNum = idx + 1;
                  const score = survey[`q${qNum}` as keyof Survey] as number | null;
                  return (
                    <div key={qNum} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-slate-50">
                      <span className="text-[10px] font-bold w-5 text-right shrink-0 text-slate-300">{qNum}</span>
                      <span className="flex-1 text-[11px] text-slate-600">{q}</span>
                      <div className="flex gap-0.5 shrink-0">
                        {[1, 2, 3, 4, 5].map((s) => {
                          const isSelected = score === s;
                          return (
                            <div
                              key={s}
                              className="h-5 w-5 rounded text-[9px] font-bold flex items-center justify-center"
                              style={{
                                background: isSelected
                                  ? s >= 4 ? "#10B981" : s >= 3 ? "#F59E0B" : "#EF4444"
                                  : "#F1F5F9",
                                color: isSelected ? "#FFF" : "#CBD5E1",
                              }}
                            >
                              {s}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 주관식 */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">주관식 답변</h4>
              <div className="space-y-2">
                {[
                  { label: "공부의 핵심", value: survey.study_core },
                  { label: "본인의 학습 문제점", value: survey.problem_self },
                  { label: "희망 직업", value: survey.dream },
                  { label: "선호 요일", value: survey.prefer_days },
                  { label: "NK학원에 바라는 점", value: survey.requests },
                  { label: "수학 어려운 영역", value: survey.math_difficulty },
                  { label: "영어 어려운 영역", value: survey.english_difficulty },
                ].map(({ label, value }) => (
                  <div key={label} className="p-2.5 rounded-lg bg-slate-50">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">{label}</span>
                    <p className="text-[11px] font-medium mt-0.5" style={{ color: value ? "#1E293B" : "#CBD5E1" }}>
                      {value || "-"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Consultation Record + Detail Memo (editable) */}
          <div className="w-1/2 overflow-y-auto p-5 space-y-4">
            {/* 상담 기록지 */}
            <section className="rounded-xl border border-amber-100 bg-amber-50/30 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-bold text-slate-700">상담 기록지</span>
                {saving && <Save className="h-3 w-3 text-amber-500 animate-pulse" />}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">기존 학원</label>
                  <Input
                    className={inp}
                    placeholder="이전 학원명"
                    value={form.prev_academy}
                    onChange={(e) => updateField("prev_academy", e.target.value)}
                    onBlur={() => handleBlur("prev_academy")}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">불만사항</label>
                  <Input
                    className={inp}
                    placeholder="기존 학원 불만"
                    value={form.prev_complaint}
                    onChange={(e) => updateField("prev_complaint", e.target.value)}
                    onBlur={() => handleBlur("prev_complaint")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">내신 점수</label>
                  <Input
                    className={inp}
                    placeholder="85점 / 3등급"
                    value={form.school_score}
                    onChange={(e) => updateField("school_score", e.target.value)}
                    onBlur={() => handleBlur("school_score")}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">테스트 점수</label>
                  <Input
                    className={inp}
                    placeholder="테스트 결과"
                    value={form.test_score}
                    onChange={(e) => updateField("test_score", e.target.value)}
                    onBlur={() => handleBlur("test_score")}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">선행 정도</label>
                  <select
                    value={form.advance_level}
                    onChange={(e) => handleSelectChange("advance_level", e.target.value)}
                    className={sel}
                  >
                    <option value="">선택</option>
                    {ADVANCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">학습 목표</label>
                  <select
                    value={form.study_goal}
                    onChange={(e) => handleSelectChange("study_goal", e.target.value)}
                    className={sel}
                  >
                    <option value="">선택</option>
                    {STUDY_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">희망 요일</label>
                  <select
                    value={form.prefer_days}
                    onChange={(e) => handleSelectChange("prefer_days", e.target.value)}
                    className={sel}
                  >
                    <option value="">선택</option>
                    {PREFERRED_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">등록 예정일</label>
                  <Input
                    type="date"
                    className={inp}
                    value={form.plan_date}
                    onChange={(e) => updateField("plan_date", e.target.value)}
                    onBlur={() => handleBlur("plan_date")}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">등록 예정반</label>
                  <select
                    value={form.plan_class}
                    onChange={(e) => handleSelectChange("plan_class", e.target.value)}
                    className={sel}
                  >
                    <option value="">선택</option>
                    {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </section>

            {/* 상세 메모 */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-700">상세 메모</span>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">학원에 바라는 점</label>
                <Textarea
                  className={`resize-none ${inp}`}
                  rows={2}
                  placeholder="학부모님이 학원에 바라는 점"
                  value={form.requests}
                  onChange={(e) => updateField("requests", e.target.value)}
                  onBlur={() => handleBlur("requests")}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">학생 상담 메모</label>
                <Textarea
                  className={`resize-none ${inp}`}
                  rows={2}
                  placeholder="학생 관련 특이사항"
                  value={form.student_consult_note}
                  onChange={(e) => updateField("student_consult_note", e.target.value)}
                  onBlur={() => handleBlur("student_consult_note")}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">학부모 상담 메모</label>
                <Textarea
                  className={`resize-none ${inp}`}
                  rows={2}
                  placeholder="학부모 상담 내용"
                  value={form.parent_consult_note}
                  onChange={(e) => updateField("parent_consult_note", e.target.value)}
                  onBlur={() => handleBlur("parent_consult_note")}
                />
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
