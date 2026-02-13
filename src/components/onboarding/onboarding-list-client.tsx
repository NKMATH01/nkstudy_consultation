"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  FileText,
  Sparkles,
  Check,
  Circle,
  ExternalLink,
  CalendarDays,
  Search,
} from "lucide-react";
import { toast } from "sonner";

const NK_PRIMARY = "#0F2B5B";
const NK_GOLD = "#D4A853";

interface OnboardingStep {
  key: string;
  label: string;
  shortLabel: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  { key: "doc_confirmed", label: "등록안내문 확인", shortLabel: "안내문" },
  { key: "mathflat_entered", label: "매쓰플랫 입력", shortLabel: "매쓰플랫" },
  { key: "clinic_entered", label: "클리닉 입력", shortLabel: "클리닉" },
  { key: "pre_parent_consult", label: "등원전 학부모상담", shortLabel: "등원전" },
  { key: "post_student_consult", label: "등원후 학생상담", shortLabel: "등원후" },
  { key: "two_week_consult", label: "2주후 학부모상담", shortLabel: "2주후" },
  { key: "four_week_consult", label: "4주후 학부모상담", shortLabel: "4주후" },
];

type Registration = {
  id: string;
  analysis_id: string | null;
  name: string;
  school: string | null;
  grade: string | null;
  student_phone: string | null;
  parent_phone: string | null;
  registration_date: string | null;
  assigned_class: string | null;
  subject: string | null;
  teacher: string | null;
  report_html: string | null;
  onboarding_status: Record<string, boolean> | null;
};

type Analysis = {
  id: string;
  name: string;
  survey_id: string | null;
  report_html: string | null;
};

interface Props {
  registrations: Registration[];
  analyses: Analysis[];
}

export function OnboardingList({ registrations, analyses }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [reportPopup, setReportPopup] = useState<string | null>(null);
  const [analysisPopup, setAnalysisPopup] = useState<string | null>(null);

  // Use local state for onboarding status (will save to DB)
  const [statusMap, setStatusMap] = useState<Record<string, Record<string, boolean>>>(() => {
    const map: Record<string, Record<string, boolean>> = {};
    registrations.forEach((r) => {
      map[r.id] = r.onboarding_status || {};
    });
    return map;
  });

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return registrations;
    const q = searchQuery.toLowerCase();
    return registrations.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.school && r.school.toLowerCase().includes(q)) ||
        (r.assigned_class && r.assigned_class.toLowerCase().includes(q))
    );
  }, [registrations, searchQuery]);

  // Toggle a step
  const toggleStep = async (regId: string, stepKey: string) => {
    const current = statusMap[regId] || {};
    const newStatus = { ...current, [stepKey]: !current[stepKey] };
    setStatusMap((prev) => ({ ...prev, [regId]: newStatus }));

    // Save to DB
    try {
      const res = await fetch("/api/onboarding-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: regId, status: newStatus }),
      });
      if (!res.ok) {
        // Revert on failure
        setStatusMap((prev) => ({ ...prev, [regId]: current }));
        toast.error("저장 실패");
      }
    } catch {
      setStatusMap((prev) => ({ ...prev, [regId]: current }));
      toast.error("저장 실패");
    }
  };

  // Count completed steps
  const getProgress = (regId: string) => {
    const status = statusMap[regId] || {};
    const done = ONBOARDING_STEPS.filter((s) => status[s.key]).length;
    return { done, total: ONBOARDING_STEPS.length };
  };

  // Find analysis for registration
  const getAnalysis = (reg: Registration) => {
    if (reg.analysis_id) {
      return analyses.find((a) => a.id === reg.analysis_id);
    }
    return analyses.find((a) => a.name === reg.name);
  };

  // Get report for popup
  const getReportHtml = (regId: string) => {
    const reg = registrations.find((r) => r.id === regId);
    return reg?.report_html || null;
  };

  return (
    <>
      <div
        className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.04)" }}
      >
        {/* Header */}
        <div
          className="border-b px-6 py-4 flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${NK_PRIMARY} 0%, #1a3d7a 100%)` }}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">신입생 등록 관리</h3>
              <p className="text-[11px] text-white/60">
                등록 완료 학생의 온보딩 진행 현황 · {registrations.length}명
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
              <input
                type="text"
                placeholder="이름 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-3 rounded-lg text-xs bg-white/10 text-white placeholder-white/40 border border-white/10 focus:outline-none focus:border-white/30 w-40"
              />
            </div>
          </div>
        </div>

        {/* Progress Legend */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-4 flex-wrap" style={{ background: "#FAFBFD" }}>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">진행 단계:</span>
          {ONBOARDING_STEPS.map((step) => (
            <span key={step.key} className="text-[11px] text-slate-500 flex items-center gap-1">
              <Circle className="h-2.5 w-2.5 text-slate-300" />
              {step.label}
            </span>
          ))}
        </div>

        {/* Table */}
        {registrations.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-6">
            <div
              className="h-20 w-20 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: `linear-gradient(135deg, ${NK_PRIMARY}10 0%, ${NK_GOLD}20 100%)` }}
            >
              <UserPlus className="h-10 w-10" style={{ color: NK_PRIMARY }} />
            </div>
            <h3 className="text-base font-bold text-slate-700 mb-1">등록된 신입생이 없습니다</h3>
            <p className="text-sm text-slate-400 max-w-xs">
              등록 안내문을 생성하면 자동으로 신입생 목록에 추가됩니다
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Column Headers */}
            <div className="px-4 py-2.5 flex items-center gap-0 border-b border-slate-100 bg-slate-50/50 min-w-[1200px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[80px] flex-shrink-0 px-2">등록일</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[70px] flex-shrink-0 px-2">이름</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[70px] flex-shrink-0 px-2">학교</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[52px] flex-shrink-0 px-2">과목</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[72px] flex-shrink-0 px-2">반명</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[90px] flex-shrink-0 px-2">학생연락처</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[90px] flex-shrink-0 px-2">학부모연락처</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-1 px-2 text-center">진행 현황</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[120px] flex-shrink-0 px-2 text-center">문서</span>
            </div>

            {/* Rows */}
            {filtered.map((reg) => {
              const progress = getProgress(reg.id);
              const status = statusMap[reg.id] || {};
              const analysis = getAnalysis(reg);
              const progressPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

              return (
                <div
                  key={reg.id}
                  className="px-4 py-3 flex items-center gap-0 border-b border-slate-100 hover:bg-slate-50/50 transition-colors min-w-[1200px]"
                >
                  {/* 등록일 */}
                  <span className="text-xs text-slate-500 w-[80px] flex-shrink-0 px-2 tabular-nums">
                    {reg.registration_date || "-"}
                  </span>

                  {/* 이름 */}
                  <span className="text-sm font-bold w-[70px] flex-shrink-0 px-2 truncate" style={{ color: NK_PRIMARY }}>
                    {reg.name}
                  </span>

                  {/* 학교 */}
                  <span className="text-xs text-slate-500 w-[70px] flex-shrink-0 px-2 truncate">
                    {reg.school || "-"}
                  </span>

                  {/* 과목 */}
                  <span className="w-[52px] flex-shrink-0 px-2">
                    {reg.subject ? (
                      <span
                        className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md ring-1 ring-inset"
                        style={{
                          background: reg.subject.includes("수학") ? "#DBEAFE" : reg.subject.includes("영어") ? "#F3E8FF" : "#F1F5F9",
                          color: reg.subject.includes("수학") ? "#1D4ED8" : reg.subject.includes("영어") ? "#7C3AED" : "#64748B",
                          ["--tw-ring-color" as string]: reg.subject.includes("수학") ? "#BFDBFE" : reg.subject.includes("영어") ? "#DDD6FE" : "#E2E8F0",
                        } as React.CSSProperties}
                      >
                        {reg.subject}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </span>

                  {/* 반명 */}
                  <span className="text-xs text-slate-600 w-[72px] flex-shrink-0 px-2 truncate font-medium">
                    {reg.assigned_class || "-"}
                  </span>

                  {/* 학생 연락처 */}
                  <span className="text-xs text-slate-400 w-[90px] flex-shrink-0 px-2 tabular-nums">
                    {reg.student_phone || "-"}
                  </span>

                  {/* 학부모 연락처 */}
                  <span className="text-xs text-slate-400 w-[90px] flex-shrink-0 px-2 tabular-nums">
                    {reg.parent_phone || "-"}
                  </span>

                  {/* 진행 현황 - Checkboxes */}
                  <div className="flex-1 px-2 flex items-center gap-1 justify-center">
                    {ONBOARDING_STEPS.map((step) => {
                      const done = status[step.key] || false;
                      return (
                        <button
                          key={step.key}
                          onClick={() => toggleStep(reg.id, step.key)}
                          className="group relative flex flex-col items-center gap-0.5"
                          title={step.label}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                              done
                                ? "bg-emerald-500 text-white shadow-sm"
                                : "bg-slate-100 text-slate-300 hover:bg-slate-200 hover:text-slate-400"
                            }`}
                          >
                            {done ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Circle className="h-3 w-3" />
                            )}
                          </div>
                          <span className={`text-[9px] leading-tight ${done ? "text-emerald-600 font-bold" : "text-slate-400"}`}>
                            {step.shortLabel}
                          </span>
                        </button>
                      );
                    })}
                    {/* Progress bar */}
                    <div className="ml-2 flex flex-col items-center gap-0.5">
                      <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${progressPct}%`,
                            background: progressPct === 100 ? "#059669" : NK_GOLD,
                          }}
                        />
                      </div>
                      <span className={`text-[9px] font-bold ${progressPct === 100 ? "text-emerald-600" : "text-slate-400"}`}>
                        {progress.done}/{progress.total}
                      </span>
                    </div>
                  </div>

                  {/* 문서 링크 - 한줄 배치 */}
                  <div className="w-[120px] flex-shrink-0 px-2 flex items-center gap-1 justify-center">
                    {reg.report_html && (
                      <button
                        onClick={() => setReportPopup(reg.id)}
                        className="h-7 px-2 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all hover:shadow-sm whitespace-nowrap"
                        style={{ background: `${NK_PRIMARY}10`, color: NK_PRIMARY }}
                        title="등록안내문 보기"
                      >
                        <FileText className="h-3 w-3" />
                        안내문
                      </button>
                    )}
                    {analysis && (
                      <button
                        onClick={() => {
                          if (analysis.report_html) {
                            setAnalysisPopup(analysis.id);
                          } else {
                            window.open(`/analyses/${analysis.id}`, '_blank');
                          }
                        }}
                        className="h-7 px-2 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all hover:shadow-sm whitespace-nowrap"
                        style={{ background: `${NK_GOLD}15`, color: "#92400E" }}
                        title="성향분석 결과 보기"
                      >
                        <Sparkles className="h-3 w-3" />
                        분석
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Report HTML Popup */}
      {reportPopup && (() => {
        const html = getReportHtml(reportPopup);
        const reg = registrations.find((r) => r.id === reportPopup);
        if (!html) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setReportPopup(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden m-4" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 z-10 px-6 py-3 border-b bg-white flex items-center justify-between" style={{ borderColor: "#E8ECF1" }}>
                <div>
                  <h2 className="text-sm font-extrabold" style={{ color: NK_PRIMARY }}>{reg?.name} 등록안내문</h2>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/registrations/${reportPopup}`}
                    target="_blank"
                    className="h-7 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all hover:shadow-sm"
                    style={{ background: NK_PRIMARY, color: "white" }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    전체 보기
                  </a>
                  <button onClick={() => setReportPopup(null)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                    <span className="text-slate-500 text-lg leading-none">&times;</span>
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 56px)" }}>
                <iframe
                  srcDoc={html}
                  className="w-full border-0"
                  style={{ minHeight: "80vh" }}
                  title="등록안내문"
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Analysis Popup - 안내문과 동일하게 팝업으로 표시 */}
      {analysisPopup && (() => {
        const analysis = analyses.find((a) => a.id === analysisPopup);
        const reg = registrations.find((r) => r.analysis_id === analysisPopup || analyses.find(a => a.id === analysisPopup && a.name === r.name));
        if (!analysis?.report_html) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAnalysisPopup(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden m-4" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 z-10 px-6 py-3 border-b bg-white flex items-center justify-between" style={{ borderColor: "#E8ECF1" }}>
                <div>
                  <h2 className="text-sm font-extrabold" style={{ color: NK_PRIMARY }}>{analysis.name} 성향분석 결과</h2>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/analyses/${analysisPopup}`}
                    target="_blank"
                    className="h-7 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all hover:shadow-sm"
                    style={{ background: NK_PRIMARY, color: "white" }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    전체 보기
                  </a>
                  <button onClick={() => setAnalysisPopup(null)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                    <span className="text-slate-500 text-lg leading-none">&times;</span>
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 56px)" }}>
                <iframe
                  srcDoc={analysis.report_html}
                  className="w-full border-0"
                  style={{ minHeight: "80vh" }}
                  title="성향분석 결과"
                />
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
