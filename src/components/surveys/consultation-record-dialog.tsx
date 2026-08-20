"use client";

import { useState, useCallback, useEffect } from "react";
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
import { SURVEY_QUESTIONS, FACTOR_LABELS, PREFERRED_DAYS, RESULT_STATUS_LABELS } from "@/types";
import { PREFERRED_DAYS_V2 } from "@/lib/assessment/v2/validation";
import { SurveyV2ResponseView } from "@/components/surveys/survey-v2-response-view";

const ADVANCE_LEVELS = ["없음", "1개월", "3개월", "6개월", "1년", "2년 이상"] as const;
const STUDY_GOALS = ["내신 향상", "선행 학습", "기초 보강", "상위권 유지", "수능 대비", "기타"] as const;
const EVALUATION_LEVELS = ["상", "중", "하"] as const;

const FACTOR_COLORS: Record<string, { bar: string; text: string }> = {
  attitude: { bar: "bg-nk-progress", text: "text-nk-progress" },
  self_directed: { bar: "bg-nk-cat-3", text: "text-nk-cat-3" },
  assignment: { bar: "bg-nk-done", text: "text-nk-done" },
  willingness: { bar: "bg-nk-warn", text: "text-nk-warn" },
  social: { bar: "bg-nk-late", text: "text-nk-late" },
  management: { bar: "bg-nk-late", text: "text-nk-late" },
  emotion: { bar: "bg-nk-cat-1", text: "text-nk-cat-1" },
};
const BASE_FACTOR_KEYS = ["attitude", "self_directed", "assignment", "willingness", "social", "management"] as const;

const sel = "w-full h-9 rounded-lg border border-nk-line-soft bg-nk-surface px-3 py-1 text-sm text-nk-ink focus:outline-none focus:ring-2 focus:ring-nk-progress/40 focus:border-nk-progress transition-colors";
const inp = "rounded-lg border-nk-line-soft focus:ring-2 focus:ring-nk-progress/40 focus:border-nk-progress transition-colors";

function withCurrentOption(options: readonly string[], current?: string | null) {
  if (!current) return [...options];
  return options.includes(current) ? [...options] : [current, ...options];
}

function firstValue(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) return normalized;
  }
  return "";
}

function buildInitialForm(survey: Survey, consultation: Consultation) {
  const isV2 = survey.instrument_version === "v2";
  return {
    prev_academy: firstValue(consultation.prev_academy, survey.prev_academy),
    prev_complaint: firstValue(consultation.prev_complaint, survey.prev_complaint),
    school_score: firstValue(consultation.school_score, isV2 ? null : survey.school_score),
    test_score: consultation.test_score ?? "",
    advance_level: firstValue(consultation.advance_level, isV2 ? null : survey.advance_level),
    study_goal: consultation.study_goal ?? "",
    prefer_days: firstValue(consultation.prefer_days, survey.prefer_days),
    plan_date: consultation.plan_date ?? "",
    plan_class: consultation.plan_class ?? "",
    referral: firstValue(consultation.referral, survey.referral),
    has_friend: consultation.has_friend ?? "",
    test_fee_paid: consultation.test_fee_paid ?? false,
    test_fee_method: consultation.test_fee_method ?? "",
    attitude: consultation.attitude ?? "",
    willingness: consultation.willingness ?? "",
    student_level: consultation.student_level ?? "",
    parent_level: consultation.parent_level ?? "",
    result_status: consultation.result_status ?? "",
    memo: consultation.memo ?? "",
    requests: firstValue(consultation.requests, survey.requests),
    student_consult_note: consultation.student_consult_note ?? "",
    parent_consult_note: consultation.parent_consult_note ?? "",
  };
}

interface Props {
  survey: Survey;
  consultation: Consultation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes?: { id: string; name: string }[];
}

export function ConsultationRecordDialog({ survey, consultation, open, onOpenChange, classes = [] }: Props) {
  const isV2 = survey.instrument_version === "v2";
  const [form, setForm] = useState(() => buildInitialForm(survey, consultation));
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(buildInitialForm(survey, consultation));
  }, [consultation, open, survey]);

  const saveField = useCallback(async (field: string, value: string | boolean) => {
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
    if (typeof value !== "string") return;
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

  const handleCheckboxChange = (field: string, value: boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    saveField(field, value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[95vw] w-[95vw] max-h-[90vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-nk-line-soft">
          <DialogTitle className="text-lg font-extrabold" style={{ color: "rgb(var(--wr-ink))" }}>
            {survey.name} - 상담 기록지
          </DialogTitle>
          <p className="text-xs text-nk-ink-sub">
            {[survey.school, survey.grade].filter(Boolean).join(" ")}
            {survey.created_at && ` | 설문일: ${new Date(survey.created_at).toLocaleDateString("ko-KR")}`}
          </p>
        </DialogHeader>

        <div className="flex overflow-hidden" style={{ height: "calc(90vh - 80px)" }}>
          {/* LEFT: Survey Preview (read-only) */}
          <div data-testid="consultation-survey-responses" className="w-1/2 border-r border-nk-line-soft overflow-y-auto p-5 space-y-3">
            <h3 className="text-sm font-bold text-nk-ink flex items-center gap-1.5">
              <ClipboardList className="h-4 w-4 text-nk-progress" />
              설문 응답
            </h3>

            {isV2 ? (
              <SurveyV2ResponseView survey={survey} variant="compact" />
            ) : (
            <>
            {/* 기본·배경 응답 */}
            <div>
              <h4 className="mb-2 text-xs font-bold text-nk-ink">기본·배경 응답</h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  { label: "학생 연락처", value: survey.student_phone },
                  { label: "학부모 연락처", value: survey.parent_phone },
                  { label: "유입경로", value: survey.referral },
                  { label: "기존 학원", value: survey.prev_academy },
                  { label: "기존 학원 아쉬운 점", value: survey.prev_complaint },
                  { label: "내신점수", value: survey.school_score },
                  { label: "모의고사/전국단위 성적", value: survey.mock_exam_score },
                  { label: "현재 진도/선행 정도", value: survey.advance_level },
                  { label: "목표 대학/계열", value: survey.target_university },
                  { label: "주중 자습 가능 시간", value: survey.weekly_study_hours },
                  { label: "등원 가능 시간대", value: survey.available_time },
                  { label: "통학 수단", value: survey.commute_method },
                  { label: "통원 소요 시간/거리", value: survey.commute_distance },
                  { label: "형제·자매", value: survey.sibling_enrolled },
                  { label: "MBTI", value: survey.mbti },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-nk-sunken p-2.5">
                    <span className="text-[10px] font-semibold text-nk-ink-hint">{label}</span>
                    <p className={`mt-0.5 whitespace-pre-wrap text-[11px] font-medium ${value ? "text-nk-ink" : "text-nk-ink-hint"}`}>
                      {value || "-"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 7-Factor */}
            <div className="p-3 rounded-xl bg-nk-sunken">
              <h4 className="text-xs font-bold text-nk-ink mb-2.5">7-Factor 학습 성향</h4>
              <div className="space-y-2">
                {(survey.factor_emotion != null ? [...BASE_FACTOR_KEYS, "emotion" as const] : BASE_FACTOR_KEYS).map((key) => {
                  const v = (survey[`factor_${key}` as keyof Survey] as number | null) ?? 0;
                  const pct = (v / 5) * 100;
                  const colors = FACTOR_COLORS[key];
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-semibold text-nk-ink-sub">{FACTOR_LABELS[key]}</span>
                        <span className={`text-[11px] font-bold ${colors.text}`}>{v.toFixed(1)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-nk-line overflow-hidden">
                        <div className={`h-full ${colors.bar} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 35문항 */}
            <div>
              <h4 className="text-xs font-bold text-nk-ink mb-2">설문 응답 ({SURVEY_QUESTIONS.length}문항)</h4>
              <div className="space-y-0.5 max-h-[400px] overflow-y-auto pr-1">
                {SURVEY_QUESTIONS.map((q, idx) => {
                  const qNum = idx + 1;
                  const score = survey[`q${qNum}` as keyof Survey] as number | null;
                  return (
                    <div key={qNum} data-testid={`v1-question-${qNum}`} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-nk-sunken">
                      <span className="text-[10px] font-bold w-5 text-right shrink-0 text-nk-ink-hint">{qNum}</span>
                      <span className="flex-1 text-[11px] text-nk-ink-sub">{q}</span>
                      <div className="flex gap-0.5 shrink-0">
                        {[1, 2, 3, 4, 5].map((s) => {
                          const isSelected = score === s;
                          return (
                            <div
                              key={s}
                              className="h-5 w-5 rounded text-[9px] font-bold flex items-center justify-center"
                              style={{
                                background: isSelected
                                  ? s >= 4 ? "rgb(var(--wr-status-done))" : s >= 3 ? "rgb(var(--wr-status-warn))" : "rgb(var(--wr-status-late))"
                                  : "rgb(var(--wr-sunken))",
                                color: isSelected ? "rgb(var(--wr-surface))" : "rgb(var(--wr-line))",
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
              <h4 className="text-xs font-bold text-nk-ink mb-2">주관식 답변</h4>
              <div className="space-y-2">
                {[
                  { label: "공부의 핵심", value: survey.study_core },
                  { label: "본인의 학습 문제점", value: survey.problem_self },
                  { label: "목표 대학/계열", value: survey.target_university },
                  { label: "희망 직업", value: survey.dream },
                  { label: "주중 자습 가능 시간", value: survey.weekly_study_hours },
                  { label: "등원 가능 시간대", value: survey.available_time },
                  { label: "선호 요일", value: survey.prefer_days },
                  { label: "내신점수", value: survey.school_score },
                  { label: "현재 진도/선행 정도", value: survey.advance_level },
                  { label: "학부모 기대치/요청", value: survey.parent_expectation },
                  { label: "NK학원에 바라는 점", value: survey.requests },
                  { label: "수학 어려운 영역", value: survey.math_difficulty },
                  { label: "영어 어려운 영역", value: survey.english_difficulty },
                  { label: "건강·특이사항", value: survey.health_note },
                ].map(({ label, value }) => (
                  <div key={label} className="p-2.5 rounded-lg bg-nk-sunken">
                    <span className="text-[10px] font-semibold text-nk-ink-hint uppercase">{label}</span>
                    <p className="text-[11px] font-medium mt-0.5" style={{ color: value ? "rgb(var(--wr-ink))" : "rgb(var(--wr-line))" }}>
                      {value || "-"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            </>
            )}
          </div>

          {/* RIGHT: Consultation Record + Detail Memo (editable) */}
          <div data-testid="consultation-editor" className="w-1/2 overflow-y-auto p-5 space-y-4">
            {/* 상담 기록지 */}
            <section className="rounded-xl border border-nk-warn bg-nk-warn-soft/30 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="h-4 w-4 text-nk-warn" />
                <span className="text-sm font-bold text-nk-ink">상담 기록지</span>
                {saving && <Save className="h-3 w-3 text-nk-warn animate-pulse" />}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-nk-ink-sub block mb-1">기존 학원</label>
                  <Input
                    className={inp}
                    placeholder="이전 학원명"
                    value={form.prev_academy}
                    onChange={(e) => updateField("prev_academy", e.target.value)}
                    onBlur={() => handleBlur("prev_academy")}
                  />
                </div>
                <div>
                  <label className="text-xs text-nk-ink-sub block mb-1">불만사항</label>
                  <Input
                    className={inp}
                    placeholder="기존 학원 불만"
                    value={form.prev_complaint}
                    onChange={(e) => updateField("prev_complaint", e.target.value)}
                    onBlur={() => handleBlur("prev_complaint")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-nk-ink-sub block mb-1">유입경로</label>
                  <Input
                    className={inp}
                    placeholder="소개/검색/광고 등"
                    value={form.referral}
                    onChange={(e) => updateField("referral", e.target.value)}
                    onBlur={() => handleBlur("referral")}
                  />
                </div>
                <div>
                  <label className="text-xs text-nk-ink-sub block mb-1">학원친구</label>
                  <Input
                    className={inp}
                    placeholder="함께 다니는 친구/지인"
                    value={form.has_friend}
                    onChange={(e) => updateField("has_friend", e.target.value)}
                    onBlur={() => handleBlur("has_friend")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex h-9 items-center gap-2 self-end rounded-lg border border-nk-warn bg-nk-surface px-3 text-xs font-medium text-nk-ink-sub">
                  <input
                    type="checkbox"
                    checked={form.test_fee_paid}
                    onChange={(e) => handleCheckboxChange("test_fee_paid", e.target.checked)}
                    className="h-4 w-4 rounded border-nk-line text-nk-warn focus:ring-nk-warn"
                  />
                  테스트비 납부
                </label>
                <div>
                  <label className="text-xs text-nk-ink-sub block mb-1">테스트비 결제수단</label>
                  <Input
                    className={inp}
                    placeholder="현금/카드/이체"
                    value={form.test_fee_method}
                    onChange={(e) => updateField("test_fee_method", e.target.value)}
                    onBlur={() => handleBlur("test_fee_method")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-nk-ink-sub block mb-1">내신 점수</label>
                  <Input
                    className={inp}
                    placeholder="85점 / 3등급"
                    value={form.school_score}
                    onChange={(e) => updateField("school_score", e.target.value)}
                    onBlur={() => handleBlur("school_score")}
                  />
                </div>
                <div>
                  <label className="text-xs text-nk-ink-sub block mb-1">테스트 점수</label>
                  <Input
                    className={inp}
                    placeholder="테스트 결과"
                    value={form.test_score}
                    onChange={(e) => updateField("test_score", e.target.value)}
                    onBlur={() => handleBlur("test_score")}
                  />
                </div>
                <div>
                  <label className="text-xs text-nk-ink-sub block mb-1">선행 정도</label>
                  <select
                    value={form.advance_level}
                    onChange={(e) => handleSelectChange("advance_level", e.target.value)}
                    className={sel}
                  >
                    <option value="">선택</option>
                    {withCurrentOption(ADVANCE_LEVELS, form.advance_level).map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-nk-ink-sub block mb-1">학습 목표</label>
                  <select
                    value={form.study_goal}
                    onChange={(e) => handleSelectChange("study_goal", e.target.value)}
                    className={sel}
                  >
                    <option value="">선택</option>
                    {withCurrentOption(STUDY_GOALS, form.study_goal).map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-nk-ink-sub block mb-1">희망 요일</label>
                  <select
                    value={form.prefer_days}
                    onChange={(e) => handleSelectChange("prefer_days", e.target.value)}
                    className={sel}
                  >
                    <option value="">선택</option>
                    {withCurrentOption(isV2 ? PREFERRED_DAYS_V2 : PREFERRED_DAYS, form.prefer_days).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-nk-ink-sub block mb-1">등록 예정일</label>
                  <Input
                    type="date"
                    className={inp}
                    value={form.plan_date}
                    onChange={(e) => updateField("plan_date", e.target.value)}
                    onBlur={() => handleBlur("plan_date")}
                  />
                </div>
                <div>
                  <label className="text-xs text-nk-ink-sub block mb-1">등록 예정반</label>
                  <select
                    value={form.plan_class}
                    onChange={(e) => handleSelectChange("plan_class", e.target.value)}
                    className={sel}
                  >
                    <option value="">선택</option>
                    {withCurrentOption(classes.map((c) => c.name), form.plan_class).map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
              </div>
            </section>

            {/* 상담 평가 */}
            <section className="rounded-xl border border-nk-line-soft bg-nk-surface p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="h-4 w-4 text-nk-ink-sub" />
                <span className="text-sm font-bold text-nk-ink">상담 평가</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { field: "attitude", label: "학습태도" },
                  { field: "willingness", label: "학습의지" },
                  { field: "student_level", label: "학생강도" },
                  { field: "parent_level", label: "학부모강도" },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <label className="text-xs text-nk-ink-sub block mb-1">{label}</label>
                    <select
                      value={form[field as keyof typeof form] as string}
                      onChange={(e) => handleSelectChange(field, e.target.value)}
                      className={sel}
                    >
                      <option value="">선택</option>
                      {withCurrentOption(
                        EVALUATION_LEVELS,
                        form[field as keyof typeof form] as string
                      ).map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </section>

            {/* 상세 메모 */}
            <section className="rounded-xl border border-nk-line-soft bg-nk-surface p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-4 w-4 text-nk-ink-sub" />
                <span className="text-sm font-bold text-nk-ink">상세 메모</span>
              </div>
              <div>
                <label className="text-xs text-nk-ink-sub block mb-1">진행 상태</label>
                <select
                  value={form.result_status}
                  onChange={(e) => handleSelectChange("result_status", e.target.value)}
                  className={sel}
                >
                  {Object.entries(RESULT_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-nk-ink-sub block mb-1">일반 메모</label>
                <Textarea
                  className={`resize-none ${inp}`}
                  rows={2}
                  placeholder="기타 메모"
                  value={form.memo}
                  onChange={(e) => updateField("memo", e.target.value)}
                  onBlur={() => handleBlur("memo")}
                />
              </div>
              <div>
                <label className="text-xs text-nk-ink-sub block mb-1">학원에 바라는 점</label>
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
                <label className="text-xs text-nk-ink-sub block mb-1">학생 상담 메모</label>
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
                <label className="text-xs text-nk-ink-sub block mb-1">학부모 상담 메모</label>
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
