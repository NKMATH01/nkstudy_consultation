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
    prev_complaint: "",
  });
  const [scores, setScores] = useState<Record<string, number>>({});
  const [openEnded, setOpenEnded] = useState({
    study_core: "",
    problem_self: "",
    dream: "",
    prefer_days: "",
    requests: "",
    math_difficulty: "",
    english_difficulty: "",
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
        <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #d1fae5, #a7f3d0)" }}>
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">설문이 제출되었습니다!</h2>
        <p className="text-slate-500 max-w-sm mx-auto leading-relaxed">
          소중한 응답 감사합니다.<br />
          NK EDU에서 꼼꼼히 분석한 후 연락드리겠습니다.
        </p>
        <div className="pt-4">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #D4A853, #B8892E)" }}>
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
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progressPercent}%`,
              background: "linear-gradient(90deg, #0F2B5B, #3b82f6)",
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
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3.5 font-medium">
          {error}
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
          className="rounded-xl h-11 px-6 font-semibold text-white shadow-lg"
          style={{
            background: step === TOTAL_STEPS - 2
              ? "linear-gradient(135deg, #10b981, #059669)"
              : "linear-gradient(135deg, #0F2B5B, #1e3a6e)",
            boxShadow: step === TOTAL_STEPS - 2
              ? "0 4px 14px rgba(16,185,129,0.3)"
              : "0 4px 14px rgba(15,43,91,0.25)",
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

function SectionHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-slate-100">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
        <Icon className="h-3.5 w-3.5" style={{ color }} />
      </div>
      <span className="text-sm font-bold text-slate-700">{title}</span>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

const fieldClass = "w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors bg-slate-50/50";

function StepInfo({
  info,
  onChange,
}: {
  info: { name: string; school: string; grade: string; student_phone: string; parent_phone: string; referral: string; referral_friend: string; prev_academy: string; prev_complaint: string };
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
        <SectionHeader icon={User} title="학생 정보" color="#3b82f6" />
        <div className="space-y-3.5">
          <div>
            <FieldLabel required>이름</FieldLabel>
            <Input
              value={info.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="학생 이름"
              className={fieldClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>학교</FieldLabel>
              <Input
                value={info.school}
                onChange={(e) => update("school", e.target.value)}
                placeholder="예: OO중학교"
                className={fieldClass}
              />
            </div>
            <div>
              <FieldLabel>학년</FieldLabel>
              <select
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
        <SectionHeader icon={Phone} title="연락처" color="#8b5cf6" />
        <div className="space-y-3.5">
          <div>
            <FieldLabel required>학생 연락처</FieldLabel>
            <Input
              value={info.student_phone}
              onChange={(e) => update("student_phone", e.target.value)}
              placeholder="010-0000-0000"
              className={fieldClass}
            />
          </div>
          <div>
            <FieldLabel required>학부모 연락처</FieldLabel>
            <Input
              value={info.parent_phone}
              onChange={(e) => update("parent_phone", e.target.value)}
              placeholder="010-0000-0000"
              className={fieldClass}
            />
          </div>
        </div>
      </div>

      {/* 학원 경로 */}
      <div>
        <SectionHeader icon={MapPin} title="학원 방문 경로" color="#f59e0b" />
        <div className="space-y-3.5">
          <div>
            <FieldLabel required>NK 학원을 알게 된 경로</FieldLabel>
            <select
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
              <FieldLabel required>소개해준 친구 이름</FieldLabel>
              <Input
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
        <SectionHeader icon={School} title="이전 학원 정보" color="#ef4444" />
        <div className="space-y-3.5">
          <div>
            <FieldLabel>기존에 다녔던 학원</FieldLabel>
            <Input
              value={info.prev_academy}
              onChange={(e) => update("prev_academy", e.target.value)}
              placeholder="예: OO학원, 1년"
              className={fieldClass}
            />
            <p className="text-[11px] text-slate-400 mt-1">학원 이름과 다닌 기간을 알려주세요.</p>
          </div>
          <div>
            <FieldLabel required>기존 학원에서 아쉬웠던 점</FieldLabel>
            <textarea
              value={info.prev_complaint}
              onChange={(e) => update("prev_complaint", e.target.value)}
              placeholder="예: 개인별 관리가 부족했다, 숙제 체크가 안 되었다 등"
              rows={3}
              className={`${fieldClass} resize-none`}
            />
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
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold mr-2 text-white" style={{ background: "linear-gradient(135deg, #0F2B5B, #1e3a6e)" }}>
                  {qNum}
                </span>
                {q}
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((val) => {
                  const isSelected = selected === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onScoreChange(qKey, val)}
                      className="flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all duration-150"
                      style={{
                        borderColor: isSelected ? "#2563EB" : "#e2e8f0",
                        background: isSelected ? "#2563EB" : "#ffffff",
                        color: isSelected ? "#ffffff" : "#94a3b8",
                        transform: isSelected ? "scale(1.03)" : "scale(1)",
                        boxShadow: isSelected ? "0 2px 8px rgba(37,99,235,0.25)" : "none",
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
  openEnded: { study_core: string; problem_self: string; dream: string; prefer_days: string; requests: string; math_difficulty: string; english_difficulty: string };
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
            <FieldLabel>공부의 핵심이 무엇이라고 생각하나요?</FieldLabel>
            <textarea
              value={openEnded.study_core}
              onChange={(e) => update("study_core", e.target.value)}
              placeholder="예: 복습과 반복이 가장 중요하다고 생각합니다"
              rows={2}
              className={`${fieldClass} resize-none`}
            />
          </div>
          <div>
            <FieldLabel>공부할 때 스스로 느끼는 문제점은?</FieldLabel>
            <textarea
              value={openEnded.problem_self}
              onChange={(e) => update("problem_self", e.target.value)}
              placeholder="예: 집중력이 오래 유지되지 않습니다"
              rows={2}
              className={`${fieldClass} resize-none`}
            />
          </div>
          <div>
            <FieldLabel>수학에서 가장 어려운 단원이나 영역은?</FieldLabel>
            <textarea
              value={openEnded.math_difficulty}
              onChange={(e) => update("math_difficulty", e.target.value)}
              placeholder="예: 함수, 도형의 성질, 확률과 통계 등"
              rows={2}
              className={`${fieldClass} resize-none`}
            />
          </div>
          <div>
            <FieldLabel>영어에서 가장 어려운 영역은?</FieldLabel>
            <textarea
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
            <FieldLabel>장래 희망이나 목표는?</FieldLabel>
            <textarea
              value={openEnded.dream}
              onChange={(e) => update("dream", e.target.value)}
              placeholder="예: 의사가 되고 싶습니다"
              rows={2}
              className={`${fieldClass} resize-none`}
            />
          </div>
          <div>
            <FieldLabel>선호하는 수업 요일</FieldLabel>
            <select
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
            <FieldLabel>학원에 바라는 점이 있나요?</FieldLabel>
            <textarea
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
