"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitPublicSurvey } from "@/lib/actions/public-survey";
import { SURVEY_QUESTIONS, GRADES } from "@/types";

const QUESTIONS_PER_PAGE = 5;
const TOTAL_SURVEY_PAGES = Math.ceil(SURVEY_QUESTIONS.length / QUESTIONS_PER_PAGE);

// Step 1: 기본정보, Step 2~7: 설문(5문항x6페이지), Step 8: 주관식, Step 9: 완료
const TOTAL_STEPS = 1 + TOTAL_SURVEY_PAGES + 1 + 1; // 9

export default function PublicSurveyPage() {
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
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
    return true; // open-ended is optional
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

  // Completed screen
  if (submitted || step === TOTAL_STEPS - 1) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">설문이 제출되었습니다!</h2>
        <p className="text-slate-500 max-w-sm mx-auto">
          소중한 응답 감사합니다. NK EDU에서 꼼꼼히 분석한 후 연락드리겠습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-500">
          <span>진행률</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPercent}%`,
              background: "linear-gradient(90deg, #0F2B5B, #2563EB)",
            }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[400px]">
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

      {/* Error */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={goPrev}
          disabled={step === 0}
          className="rounded-lg"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          이전
        </Button>

        <Button
          onClick={goNext}
          disabled={!canGoNext() || isPending}
          className="rounded-lg text-white"
          style={{
            background: step === TOTAL_STEPS - 2
              ? "linear-gradient(135deg, #10b981, #059669)"
              : "linear-gradient(135deg, #0F2B5B, #0A1E3F)",
            boxShadow: "0 4px 14px rgba(15,43,91,0.25)",
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
  "지인소개",
  "인터넷 검색",
  "블로그/카페",
  "전단지",
  "학원 앞 방문",
  "기타",
];

function StepInfo({
  info,
  onChange,
}: {
  info: { name: string; school: string; grade: string; student_phone: string; parent_phone: string; referral: string; referral_friend: string; prev_academy: string; prev_complaint: string };
  onChange: (v: typeof info) => void;
}) {
  const update = (key: string, value: string) => onChange({ ...info, [key]: value });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">기본 정보</h2>
        <p className="text-sm text-slate-500 mt-1">학생의 기본 정보를 입력해주세요.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            이름 <span className="text-red-500">*</span>
          </label>
          <Input
            value={info.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="학생 이름"
            className="rounded-lg"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">학교</label>
            <Input
              value={info.school}
              onChange={(e) => update("school", e.target.value)}
              placeholder="예: OO중학교"
              className="rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">학년</label>
            <select
              value={info.grade}
              onChange={(e) => update("grade", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            >
              <option value="">선택</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            학생 연락처 <span className="text-red-500">*</span>
          </label>
          <Input
            value={info.student_phone}
            onChange={(e) => update("student_phone", e.target.value)}
            placeholder="010-0000-0000"
            className="rounded-lg"
          />
          <p className="text-xs text-slate-400 mt-1">010-oooo-oooo 형식으로 적어주시기 바랍니다.</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            학부모 연락처 <span className="text-red-500">*</span>
          </label>
          <Input
            value={info.parent_phone}
            onChange={(e) => update("parent_phone", e.target.value)}
            placeholder="010-0000-0000"
            className="rounded-lg"
          />
          <p className="text-xs text-slate-400 mt-1">010-oooo-oooo 형식으로 적어주시기 바랍니다.</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            NK 학원을 알게 된 경로 <span className="text-red-500">*</span>
          </label>
          <select
            value={info.referral}
            onChange={(e) => update("referral", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          >
            <option value="">선택해주세요</option>
            {REFERRAL_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
        {info.referral === "친구소개" && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              소개해준 친구 이름 <span className="text-red-500">*</span>
            </label>
            <Input
              value={info.referral_friend}
              onChange={(e) => update("referral_friend", e.target.value)}
              placeholder="친구 이름 (추후 같은 반 배정 참고)"
              className="rounded-lg"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            기존에 다녔던 학원
          </label>
          <Input
            value={info.prev_academy}
            onChange={(e) => update("prev_academy", e.target.value)}
            placeholder="예: OO학원, 1년"
            className="rounded-lg"
          />
          <p className="text-xs text-slate-400 mt-1">학원이름과 다닌 기간을 알려주세요.</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            기존 학원에서 아쉬웠던 점 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={info.prev_complaint}
            onChange={(e) => update("prev_complaint", e.target.value)}
            placeholder="예: 개인별 관리가 부족했다, 숙제 체크가 안 되었다 등"
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
          />
        </div>
      </div>
    </div>
  );
}

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
          설문 문항 ({start + 1}~{end} / {SURVEY_QUESTIONS.length})
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          각 문항에 대해 1(전혀 아니다)~5(매우 그렇다)로 응답해주세요.
        </p>
      </div>

      <div className="space-y-6">
        {questions.map((q, idx) => {
          const qNum = start + idx + 1;
          const qKey = `q${qNum}`;
          const selected = scores[qKey];

          return (
            <div key={qKey} className="space-y-2.5">
              <p className="text-sm font-medium text-slate-700">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mr-2">
                  {qNum}
                </span>
                {q}
              </p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onScoreChange(qKey, val)}
                    className="flex-1 h-11 rounded-lg border-2 text-sm font-bold transition-all duration-150"
                    style={{
                      borderColor: selected === val ? "#2563EB" : "#e2e8f0",
                      background: selected === val ? "#2563EB" : "#ffffff",
                      color: selected === val ? "#ffffff" : "#64748b",
                      transform: selected === val ? "scale(1.05)" : "scale(1)",
                    }}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 px-1">
                <span>전혀 아니다</span>
                <span>매우 그렇다</span>
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
  openEnded: { study_core: string; problem_self: string; dream: string; prefer_days: string; requests: string };
  onChange: (v: typeof openEnded) => void;
}) {
  const update = (key: string, value: string) => onChange({ ...openEnded, [key]: value });

  const fields = [
    { key: "study_core", label: "공부의 핵심이 무엇이라고 생각하나요?", placeholder: "예: 복습과 반복이 가장 중요하다고 생각합니다" },
    { key: "problem_self", label: "공부할 때 스스로 느끼는 문제점은?", placeholder: "예: 집중력이 오래 유지되지 않습니다" },
    { key: "dream", label: "장래 희망이나 목표는?", placeholder: "예: 의사가 되고 싶습니다" },
    { key: "prefer_days", label: "선호하는 수업 요일은?", placeholder: "예: 월, 수, 금" },
    { key: "requests", label: "학원에 바라는 점이 있나요?", placeholder: "자유롭게 작성해주세요" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">주관식 응답</h2>
        <p className="text-sm text-slate-500 mt-1">자유롭게 작성해주세요. (선택사항)</p>
      </div>

      <div className="space-y-4">
        {fields.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
            <textarea
              value={openEnded[key as keyof typeof openEnded]}
              onChange={(e) => update(key, e.target.value)}
              placeholder={placeholder}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
