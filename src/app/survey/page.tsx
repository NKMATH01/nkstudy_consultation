"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
  User,
  Phone,
  School,
  MapPin,
  MessageSquare,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitPublicSurvey } from "@/lib/actions/public-survey";
import { SURVEY_QUESTIONS, GRADES, PREFERRED_DAYS } from "@/types";

const QUESTIONS_PER_PAGE = 5;
const TOTAL_SURVEY_PAGES = Math.ceil(SURVEY_QUESTIONS.length / QUESTIONS_PER_PAGE);

// Step 0: 기본정보, Step 1~6: 설문(5문항x6페이지), Step 7: 주관식, Step 8: 완료
const TOTAL_STEPS = 1 + TOTAL_SURVEY_PAGES + 1 + 1; // 9

const STEP_NAMES = [
  "기본 정보",
  ...Array.from({ length: TOTAL_SURVEY_PAGES }, (_, i) => `설문 ${i + 1}`),
  "주관식",
  "완료",
];

type SurveyInfoState = {
  name: string;
  school: string;
  grade: string;
  student_phone: string;
  parent_phone: string;
  referral: string;
  referral_friend: string;
  prev_academy: string;
  prev_complaint_reason: string;
  prev_complaint: string;
  school_score: string;
  mock_exam_score: string;
  advance_level: string;
  commute_method: string;
  commute_distance: string;
  sibling_enrolled: string;
};

type SurveyOpenEndedState = {
  study_core: string;
  problem_self: string;
  target_university: string;
  dream: string;
  weekly_study_hours: string;
  available_time: string;
  prefer_days: string;
  parent_expectation: string;
  requests: string;
  math_difficulty: string;
  english_difficulty: string;
  mbti: string;
  health_note: string;
};

export default function PublicSurveyPage() {
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [info, setInfo] = useState({
    name: "",
    school: "",
    grade: "",
    student_phone: "",
    parent_phone: "",
    referral: "",
    referral_friend: "",
    prev_academy: "",
    prev_complaint_reason: "",
    prev_complaint: "",
    school_score: "",
    mock_exam_score: "",
    advance_level: "",
    commute_method: "",
    commute_distance: "",
    sibling_enrolled: "",
  });
  const [scores, setScores] = useState<Record<string, number>>({});
  const [openEnded, setOpenEnded] = useState({
    study_core: "",
    problem_self: "",
    target_university: "",
    dream: "",
    weekly_study_hours: "",
    available_time: "",
    prefer_days: "",
    parent_expectation: "",
    requests: "",
    math_difficulty: "",
    english_difficulty: "",
    mbti: "",
    health_note: "",
  });

  const progressPercent = Math.round((step / (TOTAL_STEPS - 1)) * 100);

  const canGoNext = () => {
    if (step === 0) {
      if (!info.name.trim()) return false;
      if (!info.referral) return false;
      if (info.referral === "친구소개" && !info.referral_friend.trim()) return false;
      if (!info.prev_complaint.trim()) return false;
      return true;
    }
    if (step >= 1 && step <= TOTAL_SURVEY_PAGES) {
      const pageIdx = step - 1;
      const start = pageIdx * QUESTIONS_PER_PAGE;
      const end = Math.min(start + QUESTIONS_PER_PAGE, SURVEY_QUESTIONS.length);
      for (let i = start; i < end; i++) {
        if (!scores[`q${i + 1}`]) return false;
      }
      return true;
    }
    return true;
  };

  const handleSubmit = () => {
    startTransition(async () => {
      setError(null);
      const data: Record<string, unknown> = {
        ...info,
        ...scores,
        ...openEnded,
      };
      const result = await submitPublicSurvey(data);
      if (result.success) {
        setSubmitted(true);
        setStep(TOTAL_STEPS - 1);
      } else {
        setError(result.error || "제출에 실패했습니다");
      }
    });
  };

  const goNext = () => {
    if (step === TOTAL_STEPS - 2) {
      handleSubmit();
    } else {
      setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
    }
  };
  const goPrev = () => setStep((s) => Math.max(s - 1, 0));

  if (submitted || step === TOTAL_STEPS - 1) {
    return (
      <div className="text-center py-16 space-y-5">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
          <CheckCircle2 className="h-10 w-10 text-secondary-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">설문이 제출되었습니다!</h2>
        <p className="text-slate-500 max-w-sm mx-auto leading-relaxed">
          소중한 응답 감사합니다.<br />
          NK EDU에서 꼼꼼히 분석한 후 연락드리겠습니다.
        </p>
        <div className="pt-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            <Sparkles className="h-4 w-4" />
            NK Academy
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">{STEP_NAMES[step]}</span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
            {step + 1} / {TOTAL_STEPS}
          </span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            role="progressbar"
            aria-label="설문 진행률"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progressPercent}%`,
              background: "linear-gradient(90deg, var(--primary), var(--primary-soft))",
            }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6">
          {step === 0 && (
            <StepInfo info={info} onChange={setInfo} />
          )}
          {step >= 1 && step <= TOTAL_SURVEY_PAGES && (
            <StepQuestions
              pageIdx={step - 1}
              scores={scores}
              onScoreChange={(key, val) => setScores((s) => ({ ...s, [key]: val }))}
            />
          )}
          {step === TOTAL_STEPS - 2 && (
            <StepOpenEnded openEnded={openEnded} onChange={setOpenEnded} />
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-600 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSubmit}
            disabled={isPending}
            className="h-9 rounded-lg border-red-200 bg-white text-red-600 hover:bg-red-50"
          >
            다시 시도
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-1">
        <Button
          variant="outline"
          onClick={goPrev}
          disabled={step === 0}
          className="rounded-xl h-11 px-5 font-semibold"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          이전
        </Button>

        <Button
          onClick={goNext}
          disabled={!canGoNext() || isPending}
          className="h-11 rounded-xl px-6 font-semibold text-primary-foreground shadow-lg"
          style={{
            background: step === TOTAL_STEPS - 2
              ? "linear-gradient(135deg, var(--chart-2), var(--secondary-foreground))"
              : "linear-gradient(135deg, var(--primary), var(--primary-soft))",
            boxShadow: step === TOTAL_STEPS - 2
              ? "0 4px 14px rgba(143,201,168,0.30)"
              : "0 4px 14px rgba(94,147,172,0.25)",
          }}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              제출 중...
            </>
          ) : step === TOTAL_STEPS - 2 ? (
            <>
              <Send className="h-4 w-4 mr-1" />
              제출하기
            </>
          ) : (
            <>
              다음
              <ChevronRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ===== Step Components =====

const REFERRAL_OPTIONS = [
  "친구소개",
  "학부모 소개",
  "지인소개",
  "인터넷 검색",
  "블로그/카페",
  "전단지",
  "학원 앞 방문",
  "기타",
];

const PREV_COMPLAINT_REASONS = ["수업 수준", "관리 부족", "거리", "비용", "강사", "기타"];
const COMMUTE_METHODS = ["도보", "자차", "학원차량", "대중교통", "기타"];
const SIBLING_OPTIONS = ["재원중", "타학원", "없음"];
const WEEKLY_STUDY_HOURS = ["1h 미만", "1-2h", "2-3h", "3h+"];
const AVAILABLE_TIME_OPTIONS = ["평일 오후", "평일 저녁", "주말", "평일+주말", "상담 후 조정"];

function SectionHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-slate-100">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
        <Icon className="h-3.5 w-3.5" style={{ color }} />
      </div>
      <span className="text-sm font-bold text-slate-700">{title}</span>
    </div>
  );
}

function FieldLabel({ children, htmlFor, required }: { children: React.ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-slate-600 mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

const fieldClass = "w-full rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30";

function formatPhone(v: string) {
  let digits = v.replace(/\D/g, "");
  if (digits.startsWith("82")) digits = "0" + digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  const midLen = digits.length === 11 ? 4 : 3;
  return `${digits.slice(0, 3)}-${digits.slice(3, 3 + midLen)}-${digits.slice(3 + midLen)}`;
}

function StepInfo({
  info,
  onChange,
}: {
  info: SurveyInfoState;
  onChange: (v: typeof info) => void;
}) {
  const update = (key: string, value: string) => onChange({ ...info, [key]: value });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">기본 정보 입력</h2>
        <p className="text-sm text-slate-400 mt-1">학생의 기본 정보를 입력해주세요.</p>
      </div>

      {/* 학생 정보 */}
      <div>
        <SectionHeader icon={User} title="학생 정보" color="var(--chart-1)" />
        <div className="space-y-3.5">
          <div>
            <FieldLabel htmlFor="survey-name" required>이름</FieldLabel>
            <Input
              id="survey-name"
              value={info.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="학생 이름"
              className={fieldClass}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="survey-school">학교</FieldLabel>
              <Input
                id="survey-school"
                value={info.school}
                onChange={(e) => update("school", e.target.value)}
                placeholder="예: OO중학교"
                className={fieldClass}
              />
            </div>
            <div>
              <FieldLabel htmlFor="survey-grade">학년</FieldLabel>
              <select
                id="survey-grade"
                value={info.grade}
                onChange={(e) => update("grade", e.target.value)}
                className={fieldClass}
              >
                <option value="">선택</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 연락처 */}
      <div>
        <SectionHeader icon={Phone} title="연락처" color="var(--chart-5)" />
        <div className="space-y-3.5">
          <div>
            <FieldLabel htmlFor="survey-student-phone" required>학생 연락처</FieldLabel>
            <Input
              id="survey-student-phone"
              type="tel"
              inputMode="numeric"
              value={info.student_phone}
              onChange={(e) => update("student_phone", formatPhone(e.target.value))}
              placeholder="010-0000-0000"
              className={fieldClass}
            />
          </div>
          <div>
            <FieldLabel htmlFor="survey-parent-phone" required>학부모 연락처</FieldLabel>
            <Input
              id="survey-parent-phone"
              type="tel"
              inputMode="numeric"
              value={info.parent_phone}
              onChange={(e) => update("parent_phone", formatPhone(e.target.value))}
              placeholder="010-0000-0000"
              className={fieldClass}
            />
          </div>
        </div>
      </div>

      {/* 학원 경로 */}
      <div>
        <SectionHeader icon={MapPin} title="학원 방문 경로" color="var(--chart-4)" />
        <div className="space-y-3.5">
          <div>
            <FieldLabel htmlFor="survey-referral" required>NK 학원을 알게 된 경로</FieldLabel>
            <select
              id="survey-referral"
              value={info.referral}
              onChange={(e) => update("referral", e.target.value)}
              className={fieldClass}
            >
              <option value="">선택해주세요</option>
              {REFERRAL_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          {info.referral === "친구소개" && (
            <div>
              <FieldLabel htmlFor="survey-referral-friend" required>소개해준 친구 이름</FieldLabel>
              <Input
                id="survey-referral-friend"
                value={info.referral_friend}
                onChange={(e) => update("referral_friend", e.target.value)}
                placeholder="친구 이름 (추후 같은 반 배정 참고)"
                className={fieldClass}
              />
            </div>
          )}
        </div>
      </div>

      {/* 이전 학원 */}
      <div>
        <SectionHeader icon={School} title="이전 학원 정보" color="var(--destructive)" />
        <div className="space-y-3.5">
          <div>
            <FieldLabel htmlFor="survey-prev-academy">기존에 다녔던 학원</FieldLabel>
            <Input
              id="survey-prev-academy"
              value={info.prev_academy}
              onChange={(e) => update("prev_academy", e.target.value)}
              placeholder="예: OO학원, 1년"
              className={fieldClass}
            />
            <p className="text-[11px] text-slate-400 mt-1">학원 이름과 다닌 기간을 알려주세요.</p>
          </div>
          <div>
            <FieldLabel htmlFor="survey-prev-complaint-reason">기존 학원을 그만둔 결정적 이유</FieldLabel>
            <select
              id="survey-prev-complaint-reason"
              value={info.prev_complaint_reason}
              onChange={(e) => update("prev_complaint_reason", e.target.value)}
              className={fieldClass}
            >
              <option value="">선택해주세요</option>
              {PREV_COMPLAINT_REASONS.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="survey-prev-complaint" required>기존 학원에서 아쉬웠던 점</FieldLabel>
            <textarea
              id="survey-prev-complaint"
              value={info.prev_complaint}
              onChange={(e) => update("prev_complaint", e.target.value)}
              placeholder="예: 개인별 관리가 부족했다, 숙제 체크가 안 되었다 등"
              rows={3}
              className={`${fieldClass} resize-none`}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="survey-school-score">내신점수</FieldLabel>
              <Input
                id="survey-school-score"
                inputMode="decimal"
                value={info.school_score}
                onChange={(e) => update("school_score", e.target.value)}
                placeholder="예: 85점 / 3등급"
                className={fieldClass}
              />
            </div>
            <div>
              <FieldLabel htmlFor="survey-mock-exam-score">최근 모의고사/전국단위 성적</FieldLabel>
              <Input
                id="survey-mock-exam-score"
                inputMode="decimal"
                value={info.mock_exam_score}
                onChange={(e) => update("mock_exam_score", e.target.value)}
                placeholder="예: 3월 모의고사 수학 2등급"
                className={fieldClass}
              />
            </div>
            <div>
              <FieldLabel htmlFor="survey-advance-level">현재 진도 / 선행 정도</FieldLabel>
              <Input
                id="survey-advance-level"
                value={info.advance_level}
                onChange={(e) => update("advance_level", e.target.value)}
                placeholder="예: 중2-1 일차함수"
                className={fieldClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="survey-commute-method">통학 수단</FieldLabel>
              <select
                id="survey-commute-method"
                value={info.commute_method}
                onChange={(e) => update("commute_method", e.target.value)}
                className={fieldClass}
              >
                <option value="">선택</option>
                {COMMUTE_METHODS.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="survey-commute-distance">통원 소요 시간/거리</FieldLabel>
              <Input
                id="survey-commute-distance"
                value={info.commute_distance}
                onChange={(e) => update("commute_distance", e.target.value)}
                placeholder="예: 차량 20분 / 도보 10분"
                className={fieldClass}
              />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="survey-sibling-enrolled">형제·자매 재원/타학원 여부</FieldLabel>
            <select
              id="survey-sibling-enrolled"
              value={info.sibling_enrolled}
              onChange={(e) => update("sibling_enrolled", e.target.value)}
              className={fieldClass}
            >
              <option value="">선택</option>
              {SIBLING_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

const RATING_LABELS = ["전혀\n아니다", "아니다", "보통", "그렇다", "매우\n그렇다"];

function StepQuestions({
  pageIdx,
  scores,
  onScoreChange,
}: {
  pageIdx: number;
  scores: Record<string, number>;
  onScoreChange: (key: string, val: number) => void;
}) {
  const start = pageIdx * QUESTIONS_PER_PAGE;
  const end = Math.min(start + QUESTIONS_PER_PAGE, SURVEY_QUESTIONS.length);
  const questions = SURVEY_QUESTIONS.slice(start, end);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">
          성향 진단
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          {start + 1}~{end}번 / 총 {SURVEY_QUESTIONS.length}문항
        </p>
      </div>

      <div className="space-y-5">
        {questions.map((q, idx) => {
          const qNum = start + idx + 1;
          const qKey = `q${qNum}`;
          const selected = scores[qKey];

          return (
            <div key={qKey} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
              <p className="text-[13px] font-semibold text-slate-700 leading-relaxed">
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {qNum}
                </span>
                {q}
              </p>
              <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={`${qNum}. ${q}`}>
                {[1, 2, 3, 4, 5].map((val) => {
                  const isSelected = selected === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => onScoreChange(qKey, val)}
                      className={`flex min-h-[44px] flex-col items-center gap-1 rounded-xl border-2 py-2.5 text-xs font-bold transition-all duration-150 ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(94,147,172,0.25)]"
                          : "border-border bg-card text-muted-foreground"
                      }`}
                      style={{
                        transform: isSelected ? "scale(1.03)" : "scale(1)",
                      }}
                    >
                      <span className="text-base font-extrabold">{val}</span>
                      <span className="text-[10px] leading-tight whitespace-pre-line opacity-80">{RATING_LABELS[val - 1]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepOpenEnded({
  openEnded,
  onChange,
}: {
  openEnded: SurveyOpenEndedState;
  onChange: (v: typeof openEnded) => void;
}) {
  const update = (key: string, value: string) => onChange({ ...openEnded, [key]: value });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-800">주관식 응답</h2>
        </div>
        <p className="text-sm text-slate-400 mt-1">자유롭게 작성해주세요. (선택사항)</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-xs font-bold text-slate-500">학습 관련</span>
          </div>
          <div>
            <FieldLabel htmlFor="survey-study-core">공부의 핵심이 무엇이라고 생각하나요?</FieldLabel>
            <textarea
              id="survey-study-core"
              value={openEnded.study_core}
              onChange={(e) => update("study_core", e.target.value)}
              placeholder="예: 복습과 반복이 가장 중요하다고 생각합니다"
              rows={2}
              className={`${fieldClass} resize-none`}
            />
          </div>
          <div>
            <FieldLabel htmlFor="survey-problem-self">공부할 때 스스로 느끼는 문제점은?</FieldLabel>
            <textarea
              id="survey-problem-self"
              value={openEnded.problem_self}
              onChange={(e) => update("problem_self", e.target.value)}
              placeholder="예: 집중력이 오래 유지되지 않습니다"
              rows={2}
              className={`${fieldClass} resize-none`}
            />
          </div>
          <div>
            <FieldLabel htmlFor="survey-math-difficulty">수학에서 가장 어려운 단원이나 영역은?</FieldLabel>
            <textarea
              id="survey-math-difficulty"
              value={openEnded.math_difficulty}
              onChange={(e) => update("math_difficulty", e.target.value)}
              placeholder="예: 함수, 도형의 성질, 확률과 통계 등"
              rows={2}
              className={`${fieldClass} resize-none`}
            />
          </div>
          <div>
            <FieldLabel htmlFor="survey-english-difficulty">영어에서 가장 어려운 영역은?</FieldLabel>
            <textarea
              id="survey-english-difficulty"
              value={openEnded.english_difficulty}
              onChange={(e) => update("english_difficulty", e.target.value)}
              placeholder="예: 문법, 독해, 듣기, 단어 암기 등"
              rows={2}
              className={`${fieldClass} resize-none`}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-bold text-slate-500">목표 및 희망</span>
          </div>
          <div>
            <FieldLabel htmlFor="survey-target-university">목표 대학/계열</FieldLabel>
            <Input
              id="survey-target-university"
              value={openEnded.target_university}
              onChange={(e) => update("target_university", e.target.value)}
              placeholder="예: 의예과, SKY 공대, 경찰대"
              className={fieldClass}
            />
          </div>
          <div>
            <FieldLabel htmlFor="survey-dream">장래 희망이나 목표는?</FieldLabel>
            <textarea
              id="survey-dream"
              value={openEnded.dream}
              onChange={(e) => update("dream", e.target.value)}
              placeholder="예: 의사가 되고 싶습니다"
              rows={2}
              className={`${fieldClass} resize-none`}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="survey-weekly-study-hours">주중 자습 가능 시간</FieldLabel>
              <select
                id="survey-weekly-study-hours"
                value={openEnded.weekly_study_hours}
                onChange={(e) => update("weekly_study_hours", e.target.value)}
                className={fieldClass}
              >
                <option value="">선택해주세요</option>
                {WEEKLY_STUDY_HOURS.map((hours) => (
                  <option key={hours} value={hours}>{hours}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="survey-available-time">등원 가능 시간대</FieldLabel>
              <select
                id="survey-available-time"
                value={openEnded.available_time}
                onChange={(e) => update("available_time", e.target.value)}
                className={fieldClass}
              >
                <option value="">선택해주세요</option>
                {AVAILABLE_TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="survey-prefer-days">선호하는 수업 요일</FieldLabel>
            <select
              id="survey-prefer-days"
              value={openEnded.prefer_days}
              onChange={(e) => update("prefer_days", e.target.value)}
              className={fieldClass}
            >
              <option value="">선택해주세요</option>
              {PREFERRED_DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="survey-parent-expectation">학부모 기대치/요청</FieldLabel>
            <textarea
              id="survey-parent-expectation"
              value={openEnded.parent_expectation}
              onChange={(e) => update("parent_expectation", e.target.value)}
              placeholder="예: 숙제 관리, 시험 대비, 생활 습관 관리 등"
              rows={3}
              className={`${fieldClass} resize-none`}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="survey-mbti">MBTI</FieldLabel>
              <Input
                id="survey-mbti"
                value={openEnded.mbti}
                onChange={(e) => update("mbti", e.target.value.toUpperCase().slice(0, 4))}
                placeholder="예: ENFP"
                className={fieldClass}
              />
            </div>
            <div>
              <FieldLabel htmlFor="survey-health-note">건강·특이사항</FieldLabel>
              <textarea
                id="survey-health-note"
                value={openEnded.health_note}
                onChange={(e) => update("health_note", e.target.value)}
                placeholder="예: 알레르기, 집중 관련 특이사항"
                rows={2}
                className={`${fieldClass} resize-none`}
              />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="survey-requests">학원에 바라는 점이 있나요?</FieldLabel>
            <textarea
              id="survey-requests"
              value={openEnded.requests}
              onChange={(e) => update("requests", e.target.value)}
              placeholder="자유롭게 작성해주세요"
              rows={2}
              className={`${fieldClass} resize-none`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
