"use client";

// §6 사전정보 입력. 3~5개 그룹 화면으로 나눈다(점수형 한 화면 한 문항 규칙은 미적용).
// prev_leave_reason·referral·NK 기대 등은 구조화 필드로 유지한다(§10 text 병합 금지).

import type { ReactNode } from "react";
import { GRADES } from "@/types";
import {
  CLINIC_CONDITION_OPTIONS,
  MBTI_CONFIDENCE_OPTIONS,
  NK_EXPECTATION_MAX,
  NK_EXPECTATION_OPTIONS,
  PREFERRED_DAYS_V2,
  REFERRAL_OPTIONS,
  SUBJECT_OPTIONS,
} from "@/lib/assessment/v2/validation";

export interface IntakeState {
  name: string;
  school: string;
  grade: string;
  subject_selection: string;
  student_phone: string;
  parent_phone: string;
  prev_academy: string;
  prev_academy_duration: string;
  prev_leave_reason: string;
  prev_complaint: string;
  referral: string;
  referral_friend: string;
  nk_knowledge: string;
  nk_expectations: string[];
  preferred_days: string;
  available_time: string;
  weekday_selfstudy: string;
  clinic_condition: string;
  commute_method: string;
  commute_time: string;
  has_future_plan: string;
  dream: string;
  target_university: string;
  study_core: string;
  problem_self: string;
  math_difficulty: string;
  english_difficulty: string;
  health_note: string;
  requests: string;
  mbti: string;
  mbti_confidence: string;
}

export function emptyIntake(): IntakeState {
  return {
    name: "",
    school: "",
    grade: "",
    subject_selection: "",
    student_phone: "",
    parent_phone: "",
    prev_academy: "",
    prev_academy_duration: "",
    prev_leave_reason: "",
    prev_complaint: "",
    referral: "",
    referral_friend: "",
    nk_knowledge: "",
    nk_expectations: [],
    preferred_days: "",
    available_time: "",
    weekday_selfstudy: "",
    clinic_condition: "",
    commute_method: "",
    commute_time: "",
    has_future_plan: "",
    dream: "",
    target_university: "",
    study_core: "",
    problem_self: "",
    math_difficulty: "",
    english_difficulty: "",
    health_note: "",
    requests: "",
    mbti: "",
    mbti_confidence: "",
  };
}

const PHONE_RE = /^01[016789]-\d{3,4}-\d{4}$/;
const MBTI_RE = /^[EI][SN][TF][JP]$/;

export function formatPhone(v: string): string {
  let digits = v.replace(/\D/g, "");
  if (digits.startsWith("82")) digits = "0" + digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  const midLen = digits.length === 11 ? 4 : 3;
  return `${digits.slice(0, 3)}-${digits.slice(3, 3 + midLen)}-${digits.slice(3 + midLen)}`;
}

/** 사전정보 화면 라벨(진단 영역명 노출 금지 — 중립적 제목). */
export const INTAKE_SCREEN_LABELS = [
  "기본 정보",
  "학습 이력",
  "학원·일정",
  "미래와 과목",
  "성향 참고",
];

export const INTAKE_SCREEN_COUNT = INTAKE_SCREEN_LABELS.length;

/** 각 사전정보 화면의 진행 가능 조건(필수값 검증). */
export function isIntakeScreenComplete(index: number, s: IntakeState): boolean {
  switch (index) {
    case 0:
      return (
        s.name.trim().length > 0 &&
        s.school.trim().length > 0 &&
        s.grade.length > 0 &&
        (s.subject_selection === "math" ||
          s.subject_selection === "english" ||
          s.subject_selection === "both") &&
        PHONE_RE.test(s.student_phone) &&
        PHONE_RE.test(s.parent_phone)
      );
    case 1:
      // 유입 경로가 친구 소개면 소개자 이름 필요. 그 외는 선택 입력.
      if (s.referral === "친구 소개" && !s.referral_friend.trim()) return false;
      return true;
    case 2:
      return s.nk_expectations.length <= NK_EXPECTATION_MAX;
    case 3:
      return true;
    case 4: {
      // MBTI를 비워 두면 확신도도 묻지 않는다.
      const mbti = s.mbti.trim().toUpperCase();
      if (mbti === "") return true;
      // 입력했다면 4글자가 정확해야 하고, 확신도도 반드시 골라야 한다.
      // 확신도가 비면 결과지에서 MBTI를 어느 강도로 쓸지 정할 수 없다(무확신 = 미표시).
      return MBTI_RE.test(mbti) && s.mbti_confidence.trim() !== "";
    }
    default:
      return true;
  }
}

// ── 공유 필드 프리미티브 ─────────────────────────────────────────────

const fieldClass =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-[14px] transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30";

export function FieldLabel({
  children,
  htmlFor,
  required,
}: {
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-foreground">
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  inputMode?: "text" | "numeric" | "tel";
}) {
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={fieldClass}
      />
    </div>
  );
}

function TextArea({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`${fieldClass} resize-none`}
      />
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  required,
  placeholder = "선택",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── 화면 렌더러 ──────────────────────────────────────────────────────

interface IntakeProps {
  index: number;
  state: IntakeState;
  update: (patch: Partial<IntakeState>) => void;
}

export function IntakeScreen({ index, state, update }: IntakeProps) {
  const subject = state.subject_selection;
  const includeMath = subject === "math" || subject === "both";
  const includeEnglish = subject === "english" || subject === "both";

  if (index === 0) {
    return (
      <div className="space-y-4">
        <ScreenHeading title="기본 정보" desc="학생이 직접 작성하는 학습 프로필입니다." />
        <TextField id="v2-name" label="학생 이름" value={state.name} onChange={(v) => update({ name: v })} placeholder="이름" required />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField id="v2-school" label="학교" value={state.school} onChange={(v) => update({ school: v })} placeholder="예: 안산중학교" required />
          <SelectField id="v2-grade" label="학년" value={state.grade} onChange={(v) => update({ grade: v })} options={GRADES} required />
        </div>
        <div>
          <FieldLabel required>진단 과목</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {SUBJECT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update({ subject_selection: opt.value })}
                className={`min-h-[44px] rounded-xl border-2 px-3 py-2 text-[14px] font-semibold transition-colors ${
                  state.subject_selection === opt.value
                    ? "border-primary bg-primary/[0.06] text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField id="v2-student-phone" label="학생 연락처" value={state.student_phone} onChange={(v) => update({ student_phone: formatPhone(v) })} placeholder="010-0000-0000" required type="tel" inputMode="numeric" />
          <TextField id="v2-parent-phone" label="학부모 연락처" value={state.parent_phone} onChange={(v) => update({ parent_phone: formatPhone(v) })} placeholder="010-0000-0000" required type="tel" inputMode="numeric" />
        </div>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="space-y-4">
        <ScreenHeading title="학습 이력" desc="이전 학원과 NK를 알게 된 경로를 알려주세요." />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField id="v2-prev-academy" label="기존에 다녔던 학원" value={state.prev_academy} onChange={(v) => update({ prev_academy: v })} placeholder="예: OO학원" />
          <TextField id="v2-prev-duration" label="기존 학원 재원 기간" value={state.prev_academy_duration} onChange={(v) => update({ prev_academy_duration: v })} placeholder="예: 1년 6개월" />
        </div>
        <TextArea id="v2-prev-leave" label="기존 학원을 옮기려는 결정적 이유" value={state.prev_leave_reason} onChange={(v) => update({ prev_leave_reason: v })} placeholder="예: 성적이 정체되어서" />
        <TextArea id="v2-prev-complaint" label="기존 학원에서 아쉬웠던 점" value={state.prev_complaint} onChange={(v) => update({ prev_complaint: v })} placeholder="예: 개인별 관리가 부족했다" />
        <SelectField id="v2-referral" label="NK를 알게 된 경로" value={state.referral} onChange={(v) => update({ referral: v })} options={REFERRAL_OPTIONS} placeholder="선택해주세요" />
        {state.referral === "친구 소개" && (
          <TextField id="v2-referral-friend" label="소개한 친구 이름" value={state.referral_friend} onChange={(v) => update({ referral_friend: v })} placeholder="친구 이름" required />
        )}
        <TextArea id="v2-nk-knowledge" label="NK 운영을 얼마나 알고 있나요?" value={state.nk_knowledge} onChange={(v) => update({ nk_knowledge: v })} placeholder="예: 숙제 관리가 철저하다고 들었다" />
      </div>
    );
  }

  if (index === 2) {
    return (
      <div className="space-y-5">
        <ScreenHeading title="학원·일정" desc="NK에 기대하는 점과 가능한 일정을 알려주세요." />
        <div>
          <FieldLabel>NK에 기대하는 점 (최대 {NK_EXPECTATION_MAX}개)</FieldLabel>
          <NkExpectations
            selected={state.nk_expectations}
            onChange={(next) => update({ nk_expectations: next })}
          />
        </div>
        <SelectField id="v2-preferred-days" label="희망 수업 요일" value={state.preferred_days} onChange={(v) => update({ preferred_days: v })} options={PREFERRED_DAYS_V2} placeholder="선택해주세요" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField id="v2-available-time" label="등원 가능 시간대" value={state.available_time} onChange={(v) => update({ available_time: v })} placeholder="예: 평일 저녁 6시 이후" />
          <TextField id="v2-weekday-selfstudy" label="주중 자습 가능 시간" value={state.weekday_selfstudy} onChange={(v) => update({ weekday_selfstudy: v })} placeholder="예: 평일 2시간" />
        </div>
        <div>
          <FieldLabel htmlFor="v2-clinic">클리닉 참여 가능 조건</FieldLabel>
          <select id="v2-clinic" value={state.clinic_condition} onChange={(e) => update({ clinic_condition: e.target.value })} className={fieldClass}>
            <option value="">선택해주세요</option>
            {CLINIC_CONDITION_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.label}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField id="v2-commute-method" label="통학 수단" value={state.commute_method} onChange={(v) => update({ commute_method: v })} placeholder="예: 도보 / 자차 / 학원차량" />
          <TextField id="v2-commute-time" label="통원 소요 시간" value={state.commute_time} onChange={(v) => update({ commute_time: v })} placeholder="예: 15분" />
        </div>
      </div>
    );
  }

  if (index === 3) {
    return (
      <div className="space-y-4">
        <ScreenHeading title="미래와 과목" desc="목표와 과목별 어려움을 자유롭게 적어주세요." />
        <TextField id="v2-future-plan" label="미래 계획이 있나요?" value={state.has_future_plan} onChange={(v) => update({ has_future_plan: v })} placeholder="예: 아직 고민 중 / 뚜렷한 목표 있음" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField id="v2-dream" label="하고 싶은 직업 또는 목표" value={state.dream} onChange={(v) => update({ dream: v })} placeholder="예: 의사, 개발자" />
          <TextField id="v2-target-univ" label="목표 대학·계열·전공" value={state.target_university} onChange={(v) => update({ target_university: v })} placeholder="예: 공대, 의예과" />
        </div>
        <TextArea id="v2-study-core" label="공부의 핵심이 무엇이라고 생각하나요?" value={state.study_core} onChange={(v) => update({ study_core: v })} placeholder="예: 꾸준한 복습" />
        <TextArea id="v2-problem-self" label="공부할 때 스스로 느끼는 문제점은?" value={state.problem_self} onChange={(v) => update({ problem_self: v })} placeholder="예: 집중이 오래 안 된다" />
        {includeMath && (
          <TextArea id="v2-math-diff" label="수학에서 가장 어려운 단원·영역" value={state.math_difficulty} onChange={(v) => update({ math_difficulty: v })} placeholder="예: 함수, 도형" />
        )}
        {includeEnglish && (
          <TextArea id="v2-eng-diff" label="영어에서 가장 어려운 영역" value={state.english_difficulty} onChange={(v) => update({ english_difficulty: v })} placeholder="예: 독해, 문법" />
        )}
        <TextArea id="v2-health" label="건강·특이사항" value={state.health_note} onChange={(v) => update({ health_note: v })} placeholder="예: 특이사항 없음" />
        <TextArea id="v2-requests" label="학원에 바라는 점" value={state.requests} onChange={(v) => update({ requests: v })} placeholder="자유롭게 작성해주세요" />
      </div>
    );
  }

  // index === 4
  return (
    <div className="space-y-4">
      <ScreenHeading title="성향 참고" desc="MBTI는 지도 방식 참고용으로만 쓰이며, 성실성·의지 점수에는 반영되지 않습니다." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField id="v2-mbti" label="알고 있는 MBTI 4글자" value={state.mbti} onChange={(v) => update({ mbti: v.toUpperCase().slice(0, 4) })} placeholder="예: ENFP (모르면 비워두세요)" />
        <SelectField id="v2-mbti-conf" label="MBTI 확신도" value={mbtiConfidenceLabel(state.mbti_confidence)} onChange={(v) => update({ mbti_confidence: mbtiConfidenceValue(v) })} options={MBTI_CONFIDENCE_OPTIONS.map((o) => o.label)} placeholder="선택" />
      </div>
      {state.mbti.trim() !== "" && !MBTI_RE.test(state.mbti.trim().toUpperCase()) && (
        <p className="text-[12px] font-medium text-destructive">
          MBTI 4글자를 정확히 입력하거나 비워주세요 (예: ENFP).
        </p>
      )}
      {MBTI_RE.test(state.mbti.trim().toUpperCase()) && state.mbti_confidence.trim() === "" && (
        <p className="text-[12px] font-medium text-destructive">
          MBTI를 적었다면 확신도도 골라주세요. 얼마나 확신하는지에 따라 결과지에 반영되는 정도가 달라집니다.
        </p>
      )}
    </div>
  );
}

function mbtiConfidenceLabel(value: string): string {
  return MBTI_CONFIDENCE_OPTIONS.find((o) => o.value === value)?.label ?? "";
}
function mbtiConfidenceValue(label: string): string {
  return MBTI_CONFIDENCE_OPTIONS.find((o) => o.label === label)?.value ?? "none";
}

function ScreenHeading({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h2 className="text-[18px] font-bold text-foreground">{title}</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">{desc}</p>
    </div>
  );
}

function NkExpectations({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const atMax = selected.length >= NK_EXPECTATION_MAX;
  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else if (!atMax) {
      onChange([...selected, opt]);
    }
  };
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {NK_EXPECTATION_OPTIONS.map((opt) => {
        const isOn = selected.includes(opt);
        const disabled = !isOn && atMax;
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={isOn}
            disabled={disabled}
            onClick={() => toggle(opt)}
            className={`min-h-[44px] rounded-xl border-2 px-3 py-2 text-left text-[13px] font-medium transition-colors ${
              isOn
                ? "border-primary bg-primary/[0.06] text-primary"
                : disabled
                  ? "cursor-not-allowed border-border bg-muted/40 text-muted-foreground/50"
                  : "border-border bg-card text-foreground hover:border-primary/40"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
