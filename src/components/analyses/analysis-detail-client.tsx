"use client";

import { useTransition, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Trash2, ClipboardList, RefreshCw, CheckCircle, AlertTriangle, FileCheck, ExternalLink, Phone, MessageCircle, Link2, MessageSquareText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteAnalysis, regenerateAnalysisReport } from "@/lib/actions/analysis";
import { generateRegistration } from "@/lib/actions/registration";
import { RegistrationForm } from "@/components/registrations/registration-form-client";
import type { Analysis, Class, Teacher, ResultStatus } from "@/types";
import type { RegistrationAdminFormData } from "@/lib/validations/registration";
import { FACTOR_LABELS, RESULT_STATUS_LABELS } from "@/types";
import Link from "next/link";
import { createReportToken } from "@/lib/actions/report-token";
import { shareViaKakao, KAKAO_BASE_URL } from "@/lib/kakao";
import { AlimtalkSendDialog } from "@/components/alimtalk/alimtalk-send-dialog";
import {
  buildAnalysisResultVars,
  ANALYSIS_RESULT_TEMPLATE_CODE,
} from "@/lib/analysis-alimtalk";

interface Props {
  analysis: Analysis;
  classes: Class[];
  teachers: Teacher[];
  surveyId?: string | null;
  consultationResultStatus?: ResultStatus | null;
  consultationData?: Record<string, string | null> | null;
  existingRegistrationId?: string | null;
  studentPhone?: string | null;
  parentPhone?: string | null;
  consultationId?: string | null;
}

function ratingClass(score: number) {
  if (score >= 4) return { bg: "bg-nk-done-soft text-nk-done", bar: "from-nk-done to-nk-done", label: "우수" };
  if (score >= 3) return { bg: "bg-nk-progress-soft text-nk-progress", bar: "from-nk-progress to-nk-progress", label: "양호" };
  if (score >= 2) return { bg: "bg-nk-warn-soft text-nk-warn", bar: "from-nk-warn to-nk-warn", label: "보통" };
  return { bg: "bg-nk-late-soft text-nk-late", bar: "from-nk-late to-nk-late", label: "주의" };
}

const STEP_COLORS = ["bg-nk-progress", "bg-nk-cat-3", "bg-nk-warn", "bg-nk-done"];

export function AnalysisDetailClient({ analysis, classes, teachers, consultationResultStatus, consultationData, existingRegistrationId, studentPhone, parentPhone, consultationId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const [showRegForm, setShowRegForm] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showAlimtalk, setShowAlimtalk] = useState(false);

  // 발송 직전에 새 열람 토큰을 만들어 링크 변수로 넘긴다.
  const prepareAlimtalk = useCallback(async () => {
    if (!analysis.report_html || !parentPhone) return null;

    const result = await createReportToken({
      reportType: "analysis",
      reportHtml: analysis.report_html,
      name: analysis.name,
    });
    if (!result.success || !result.token) return null;

    return {
      templateCode: ANALYSIS_RESULT_TEMPLATE_CODE,
      phone: parentPhone,
      vars: buildAnalysisResultVars(analysis, result.token),
      subjectType: "analysis",
      subjectId: analysis.id,
    };
  }, [analysis, parentPhone]);

  const handleShareKakao = async () => {
    if (!analysis.report_html) return;
    setIsSharing(true);
    try {
      const result = await createReportToken({
        reportType: "analysis",
        reportHtml: analysis.report_html,
        name: analysis.name,
      });
      if (!result.success || !result.token) {
        toast.error("공유 링크 생성에 실패했습니다");
        return;
      }
      await shareViaKakao({
        title: `${analysis.name} 성향분석 결과`,
        description: "NK학원 학습 성향 분석 결과입니다.",
        pageUrl: `/report/${result.token}`,
      });
    } catch {
      toast.error("카카오톡 공유에 실패했습니다");
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!analysis.report_html) return;
    try {
      toast.info("링크 생성 중...");
      const result = await createReportToken({
        reportType: "analysis",
        reportHtml: analysis.report_html,
        name: analysis.name,
      });
      if (!result.success || !result.token) {
        toast.error("링크 생성에 실패했습니다");
        return;
      }
      await navigator.clipboard.writeText(`${KAKAO_BASE_URL}/report/${result.token}`);
      toast.success("링크가 복사되었습니다");
    } catch {
      toast.error("링크 복사에 실패했습니다");
    }
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteAnalysis(analysis.id);
      if (result.success) {
        toast.success("분석 결과가 삭제되었습니다");
        router.push("/surveys");
      } else {
        toast.error(result.error || "삭제에 실패했습니다");
      }
    });
  };

  const handleGenerateRegistration = async (data: RegistrationAdminFormData) => {
    const result = await generateRegistration(analysis.id, data);
    if (result.success && result.data) {
      toast.success("등록 안내문이 생성되었습니다");
      if (result.warning) toast.warning(result.warning);
      setShowRegForm(false);
      router.push(`/registrations/${result.data.id}`);
    } else {
      toast.error(result.error || "등록 안내문 생성에 실패했습니다");
    }
  };

  const handleRegisterClick = () => {
    if (existingRegistrationId) {
      router.push(`/registrations/${existingRegistrationId}`);
    } else {
      setShowRegForm(true);
    }
  };

  const baseFKeys = ["attitude", "self_directed", "assignment", "willingness", "social", "management"] as const;
  const factorKeys = analysis.score_emotion != null ? [...baseFKeys, "emotion" as const] : baseFKeys;
  const schoolInfo = [analysis.school, analysis.grade].filter(Boolean).join(" ");
  const createdDate = analysis.created_at
    ? new Date(analysis.created_at).toLocaleDateString("ko-KR")
    : "";

  // 상담 결과 상태 배지 스타일
  const resultStatusStyle: Record<string, string> = {
    registered: "bg-nk-late text-nk-navy-ink",
    hold: "bg-nk-warn text-nk-navy-ink",
    other: "bg-nk-ink-hint text-nk-navy-ink",
  };

  return (
    <div className="space-y-5 max-w-lg mx-auto px-4 pb-8">
      {/* Header */}
      <div className="border-b-[3px] border-nk-progress pb-3">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="icon" asChild className="rounded-xl hover:bg-nk-sunken h-8 w-8">
            <Link href="/surveys">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <p className="text-[10px] font-bold text-nk-progress tracking-widest uppercase">NK EDUCATION</p>
        </div>
        <h1 className="text-lg font-black text-nk-ink tracking-tight leading-tight">
          NK 심층 학습 성향 분석서
        </h1>
        <p className="text-[10px] text-nk-ink-hint mb-2">Deep Learning Tendency Analysis Report</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-base font-extrabold text-nk-progress">{analysis.name}</p>
            {consultationResultStatus && consultationResultStatus !== "none" && (
              <Badge className={`text-[10px] border-0 ${resultStatusStyle[consultationResultStatus] || ""}`}>
                {RESULT_STATUS_LABELS[consultationResultStatus]}
              </Badge>
            )}
          </div>
          <p className="text-xs text-nk-ink-sub">{schoolInfo}{createdDate && ` · ${createdDate}`}</p>
        </div>
      </div>

      {/* 공유 버튼 */}
      {analysis.report_html && (
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShareKakao}
            disabled={isSharing}
            className="rounded-xl text-xs"
          >
            <MessageCircle className={`h-3.5 w-3.5 mr-1 ${isSharing ? "animate-pulse" : ""}`} />
            카카오톡
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="rounded-xl text-xs"
          >
            <Link2 className="h-3.5 w-3.5 mr-1" />
            링크복사
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAlimtalk(true)}
            disabled={!parentPhone}
            className="rounded-xl text-xs"
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            알림톡
          </Button>
        </div>
      )}

      {/* 연락처 */}
      {(studentPhone || parentPhone) && (
        <div className="flex gap-3">
          {studentPhone && (
            <div className="flex-1 bg-nk-surface rounded-xl border border-nk-line-soft shadow-sm p-3 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-nk-progress-soft flex items-center justify-center shrink-0">
                <Phone className="h-3.5 w-3.5 text-nk-progress" />
              </div>
              <div>
                <p className="text-[10px] text-nk-ink-hint font-medium">학생 연락처</p>
                <p className="text-xs font-bold text-nk-ink">{studentPhone}</p>
              </div>
            </div>
          )}
          {parentPhone && (
            <div className="flex-1 bg-nk-surface rounded-xl border border-nk-line-soft shadow-sm p-3 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-nk-done-soft flex items-center justify-center shrink-0">
                <Phone className="h-3.5 w-3.5 text-nk-done" />
              </div>
              <div>
                <p className="text-[10px] text-nk-ink-hint font-medium">학부모 연락처</p>
                <p className="text-xs font-bold text-nk-ink">{parentPhone}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Registration Status Card */}
      <div className="bg-nk-surface rounded-xl border border-nk-line-soft shadow-sm p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-bold text-nk-ink">등록 안내</h3>
            {existingRegistrationId && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-nk-done">
                <FileCheck className="h-3 w-3" />
                생성됨
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleRegisterClick}
            className="rounded-xl bg-gradient-to-r from-nk-done to-nk-done shadow-lg shadow-nk-done/20 text-xs"
          >
            <ClipboardList className="h-3.5 w-3.5 mr-1" />
            {existingRegistrationId ? "등록 안내 보기" : "등록 안내 생성"}
            {existingRegistrationId && <ExternalLink className="h-3 w-3 ml-1" />}
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {consultationId && (
          <Button variant="outline" size="sm" asChild className="rounded-xl text-xs">
            <Link href={`/consultations/${consultationId}`}>
              <MessageSquareText className="mr-1 h-3.5 w-3.5" />
              상담 보기
            </Link>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            startTransition(async () => {
              const result = await regenerateAnalysisReport(analysis.id);
              if (result.success) {
                toast.success("보고서가 재생성되었습니다.");
                router.refresh();
              } else {
                toast.error(result.error || "재생성 실패");
              }
            });
          }}
          disabled={isPending}
          className="rounded-xl text-xs shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isPending ? "animate-spin" : ""}`} />
          재생성
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowDelete(true)}
          className="rounded-xl text-xs shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          삭제
        </Button>
      </div>

      {/* Executive Summary */}
      <div className="bg-gradient-to-br from-nk-progress-soft to-nk-sunken border border-nk-progress rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h3 className="text-sm font-extrabold text-nk-progress">종합 평가</h3>
          {analysis.student_type && (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-nk-done-soft text-nk-done">
              {analysis.student_type}
            </span>
          )}
        </div>
        {analysis.summary && (
          <p className="text-[13px] leading-relaxed text-nk-ink">{analysis.summary}</p>
        )}
      </div>

      {/* 6-Factor 학습 성향 분석 - 카드 레이아웃 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-nk-progress rounded-sm" />
          <h3 className="text-sm font-extrabold text-nk-progress">{analysis.score_emotion != null ? "7" : "6"}-Factor 학습 성향 분석</h3>
        </div>
        <div className="space-y-2.5">
          {factorKeys.map((key) => {
            const score = (analysis[`score_${key}` as keyof Analysis] as number | null) ?? 0;
            const comment = (analysis[`comment_${key}` as keyof Analysis] as string | null) || "";
            const pct = (score / 5) * 100;
            const rating = ratingClass(score);
            return (
              <div key={key} className="bg-nk-surface rounded-xl border border-nk-line-soft shadow-sm p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-[13px] text-nk-ink">{FACTOR_LABELS[key]}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-nk-progress">{score.toFixed(1)}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rating.bg}`}>
                      {rating.label}
                    </span>
                  </div>
                </div>
                <div className="h-2.5 bg-nk-sunken rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full bg-gradient-to-r ${rating.bar} rounded-full transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {comment && (
                  <p className="text-[11px] text-nk-ink-sub leading-relaxed">{comment}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Core Competency Matrix */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-nk-progress rounded-sm" />
          <h3 className="text-sm font-extrabold text-nk-progress">핵심 역량 분석</h3>
        </div>
        <div className="space-y-3">
          {/* Strengths */}
          <div className="bg-nk-surface rounded-xl border border-nk-line-soft shadow-sm p-4">
            <h4 className="text-[13px] font-bold text-nk-done mb-3 flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" />
              강점
            </h4>
            <div className="space-y-2.5">
              {(analysis.strengths || []).map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-nk-done flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle className="h-2.5 w-2.5 text-nk-navy-ink" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[13px] text-nk-ink">{item.title}</p>
                    <p className="text-[11px] text-nk-ink-sub mt-0.5 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
              {(!analysis.strengths || analysis.strengths.length === 0) && (
                <p className="text-[11px] text-nk-ink-hint">데이터 없음</p>
              )}
            </div>
          </div>

          {/* Weaknesses */}
          <div className="bg-nk-surface rounded-xl border border-nk-line-soft shadow-sm p-4">
            <h4 className="text-[13px] font-bold text-nk-late mb-3 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              개선 영역
            </h4>
            <div className="space-y-2.5">
              {(analysis.weaknesses || []).map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-nk-late flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="h-2.5 w-2.5 text-nk-navy-ink" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[13px] text-nk-ink">{item.title}</p>
                    <p className="text-[11px] text-nk-ink-sub mt-0.5 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
              {(!analysis.weaknesses || analysis.weaknesses.length === 0) && (
                <p className="text-[11px] text-nk-ink-hint">데이터 없음</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Psychological Gap Analysis */}
      {analysis.paradox && analysis.paradox.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-nk-warn rounded-sm" />
            <h3 className="text-sm font-extrabold text-nk-progress">심리적 갭 분석</h3>
          </div>
          <div className="space-y-2.5">
            {analysis.paradox.map((item, idx) => (
              <div key={idx} className="bg-nk-surface rounded-xl border border-nk-line-soft shadow-sm p-4">
                <p className="font-extrabold text-[13px] text-nk-ink mb-1.5">
                  GAP {idx + 1}: {String(item.title || "")}
                </p>
                <p className="text-[11px] text-nk-ink-sub leading-relaxed mb-2.5">
                  {String(item.description || "")}
                </p>
                {"label1" in item && "label2" in item && (
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="font-semibold text-nk-progress bg-nk-progress-soft px-2 py-1 rounded-lg">
                      {String(item.label1)}: {String(item.value1)}
                    </span>
                    <span className="font-semibold text-nk-late bg-nk-late-soft px-2 py-1 rounded-lg">
                      {String(item.label2)}: {String(item.value2)}
                    </span>
                  </div>
                )}
                {"studentView" in item && "nkView" in item && (
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="font-semibold text-nk-progress bg-nk-progress-soft px-2 py-1 rounded-lg">
                      학생 인식: {String(item.studentView)}
                    </span>
                    <span className="font-semibold text-nk-cat-3 bg-nk-cat-3-soft px-2 py-1 rounded-lg">
                      NK 평가: {String(item.nkView)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 12-Week Customized Solution */}
      {analysis.solutions && analysis.solutions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-nk-progress rounded-sm" />
            <h3 className="text-sm font-extrabold text-nk-progress">12주 맞춤 솔루션</h3>
          </div>
          <div className="space-y-2.5">
            {analysis.solutions.map((sol, idx) => (
              <div key={idx} className="flex bg-nk-surface rounded-xl border border-nk-line-soft shadow-sm overflow-hidden">
                <div className={`w-1 shrink-0 ${STEP_COLORS[idx % STEP_COLORS.length]}`} />
                <div className="p-3.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[10px] font-extrabold text-nk-navy-ink px-2 py-0.5 rounded ${STEP_COLORS[idx % STEP_COLORS.length]}`}>
                      STEP {sol.step}
                    </span>
                    <span className="text-[10px] text-nk-ink-hint font-semibold">{sol.weeks}</span>
                  </div>
                  <p className="font-bold text-[13px] text-nk-ink mb-1.5">{sol.goal}</p>
                  {sol.actions && (
                    <ul className="list-disc list-inside text-[11px] text-nk-ink-sub space-y-0.5 leading-relaxed">
                      {sol.actions.map((action, aIdx) => (
                        <li key={aIdx}>{action}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final Assessment */}
      {analysis.final_assessment && (
        <div className="bg-gradient-to-br from-nk-navy-strong to-nk-navy-strong rounded-xl p-5 text-nk-navy-ink shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-nk-progress" />
            <h3 className="text-sm font-extrabold text-nk-progress-soft">최종 평가</h3>
          </div>
          <p className="text-[13px] leading-relaxed opacity-95">{analysis.final_assessment}</p>
        </div>
      )}

      {/* 등록 안내 생성 폼 */}
      <RegistrationForm
        open={showRegForm}
        onOpenChange={setShowRegForm}
        onSubmit={handleGenerateRegistration}
        grade={analysis.grade}
        classes={classes}
        teachers={teachers}
        consultationData={consultationData}
      />

      {/* 삭제 확인 */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>분석 결과 삭제</DialogTitle>
            <DialogDescription>
              &quot;{analysis.name}&quot; 분석 결과를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)} className="rounded-xl">
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-xl"
            >
              {isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlimtalkSendDialog
        open={showAlimtalk}
        onOpenChange={setShowAlimtalk}
        prepare={prepareAlimtalk}
        targetLabel={analysis.name}
        title="성향분석 결과지 알림톡 발송"
      />
    </div>
  );
}
