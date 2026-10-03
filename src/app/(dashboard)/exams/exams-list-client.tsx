"use client";

import { useCallback, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileChartColumn,
  FileCheck,
  FileImage,
  FileSearch,
  Loader2,
  ScanSearch,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlimtalkSendDialog } from "@/components/alimtalk/alimtalk-send-dialog";
import {
  markExamReportSent,
  prepareExamReportAlimtalk,
  requestExamAnalysis,
  type ExamAnalysis,
} from "@/lib/actions/exam-analysis";
import {
  EXAM_STATUS_LABEL,
  examFlowIcons,
  type ExamFlowSnapshot,
  type ExamIconState,
  type ExamIconTone,
  type ExamListChip,
} from "@/lib/exam-alimtalk";
import { shareViaKakao, KAKAO_BASE_URL } from "@/lib/kakao";

const STATUS_CLASS: Record<ExamListChip, string> = {
  unregistered: "bg-nk-surface text-nk-ink-hint ring-nk-line-soft",
  draft: "bg-nk-sunken text-nk-ink-sub ring-nk-line",
  pending: "bg-nk-warn-soft text-nk-warn ring-nk-warn",
  analyzing: "bg-nk-progress-soft text-nk-progress ring-nk-progress",
  done: "bg-nk-done-soft text-nk-done ring-nk-done",
  sent: "bg-nk-navy-soft text-nk-navy ring-nk-navy",
};

export function ExamStatusBadge({ status }: { status: ExamListChip }) {
  const className = STATUS_CLASS[status] ?? STATUS_CLASS.pending;
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${className}`}
    >
      {EXAM_STATUS_LABEL[status] ?? EXAM_STATUS_LABEL.pending}
    </span>
  );
}

export function formatExamDate(value: string | null): string {
  if (!value) return "-";
  return value.slice(0, 10);
}

// ─── 분석지 공유(카카오톡·링크 복사·알림톡) — 상세 화면과 목록이 같이 쓴다 ─────────
/**
 * 분석지 링크는 exam-push 가 올릴 때 이미 만들어 둔다. 여기서는 그 토큰을 그대로 쓴다.
 * 알림톡 발송 인자는 서버가 만든다(학부모 번호·회수 확인·링크 기간 연장).
 * 다이얼로그는 성공 콜백이 없으므로, 닫힐 때 서버가 실제 발송 기록을 확인한 경우에만 'sent' 로 바꾼다.
 */
export function useExamReportSharing(
  analysis: Pick<ExamAnalysis, "id" | "student_name" | "subject" | "status" | "report_token">,
  options: { toastWhenTemplatePending?: boolean } = {},
) {
  const router = useRouter();
  const { toastWhenTemplatePending = false } = options;
  const reportToken = analysis.report_token;
  const hasReport = !!reportToken && (analysis.status === "done" || analysis.status === "sent");
  const reportUrl = reportToken ? `${KAKAO_BASE_URL}/report/${reportToken}` : "";
  const [sharing, setSharing] = useState(false);
  const [alimtalkOpen, setAlimtalkOpen] = useState(false);
  const [kakaoPending, setKakaoPending] = useState(false);

  const handleShare = async () => {
    if (!reportToken) return;
    setSharing(true);
    try {
      await shareViaKakao({
        title: `${analysis.student_name} 학생 ${analysis.subject?.trim() || "수학"} 정밀 진단 리포트`,
        description: "NK학원 입학테스트 답안을 한 문항씩 분석한 결과입니다.",
        pageUrl: `/report/${reportToken}`,
      });
    } catch {
      toast.error("카카오톡 공유에 실패했습니다");
    } finally {
      setSharing(false);
    }
  };

  const handleCopy = async () => {
    if (!reportUrl) return;
    try {
      await navigator.clipboard.writeText(reportUrl);
      toast.success("링크를 복사했습니다. 학부모님께 붙여넣어 보내세요.");
    } catch {
      toast.error("링크 복사에 실패했습니다. 보고서 보기를 눌러 주소창에서 복사해 주세요.");
    }
  };

  const prepareAlimtalk = useCallback(async () => {
    const result = await prepareExamReportAlimtalk(analysis.id);
    if (!result.success) {
      toast.error(result.error);
      return null;
    }
    setKakaoPending(result.templatePending);
    if (result.templatePending && toastWhenTemplatePending) {
      toast.warning("입학테스트 알림톡은 카카오 심사 대기 중입니다. 그동안은 카카오톡 공유나 링크 복사로 보내 주세요.");
    }
    return result.data;
  }, [analysis.id, toastWhenTemplatePending]);

  const handleAlimtalkOpenChange = (open: boolean) => {
    setAlimtalkOpen(open);
    if (open) return;
    void markExamReportSent(analysis.id).then((result) => {
      if (result.success && result.marked) router.refresh();
    });
  };

  const alimtalkDialog = (
    <AlimtalkSendDialog
      open={alimtalkOpen}
      onOpenChange={handleAlimtalkOpenChange}
      prepare={prepareAlimtalk}
      targetLabel={analysis.student_name}
      title="입학테스트 리포트 알림톡 발송"
    />
  );

  return {
    reportToken,
    hasReport,
    sharing,
    kakaoPending,
    handleShare,
    handleCopy,
    openAlimtalk: () => setAlimtalkOpen(true),
    alimtalkDialog,
  };
}

// ─── 아이콘 3개(시험지·매쓰플랫·분석 요청) — 설문 목록과 입학테스트 목록이 같이 쓴다 ─────

const TONE_CLASS: Record<ExamIconTone, string> = {
  off: "text-nk-ink-hint",
  empty: "text-nk-ink-hint opacity-50 hover:bg-nk-sunken hover:opacity-100",
  filled: "text-nk-navy hover:bg-nk-navy-soft",
  ready: "text-nk-progress hover:bg-nk-progress-soft",
  requested: "text-nk-warn",
  analyzing: "text-nk-progress",
  done: "text-nk-done hover:bg-nk-done-soft",
};

const stop = (e: MouseEvent) => e.stopPropagation();

function FlowIconButton({
  state,
  icon,
  busy = false,
  onClick,
  testId,
}: {
  state: ExamIconState;
  icon: ReactNode;
  busy?: boolean;
  onClick: () => void;
  testId?: string;
}) {
  // 분석 요청됨·분석 중은 눌리지 않지만 색은 보여야 하므로 disabled:opacity 를 쓰지 않는다.
  const disabled = !state.enabled || busy;
  const dimDisabled = !state.enabled && (state.tone === "empty" || state.tone === "off");
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      aria-label={state.title}
      title={state.title}
      onClick={(e) => {
        stop(e);
        if (!disabled) onClick();
      }}
      className={`p-1 rounded transition-colors ${
        dimDisabled ? "text-nk-ink-hint opacity-30" : TONE_CLASS[state.tone]
      } ${disabled ? "cursor-not-allowed hover:bg-transparent" : ""}`}
    >
      {icon}
    </button>
  );
}

/**
 * 시험지·매쓰플랫 올리기 + 분석 요청 아이콘.
 * consultationCount 가 1이 아니면 셋 다 막는다(누구 시험인지 모름). 규칙은 examFlowIcons(순수 함수).
 */
export function ExamFlowIcons({
  consultationId,
  consultationCount,
  exam,
  from,
  size = "sm",
  testIdPrefix,
}: {
  consultationId: string | null;
  consultationCount: number;
  exam: ExamFlowSnapshot | null;
  /** 올린 뒤 돌아갈 목록. */
  from: "surveys" | "exams";
  size?: "sm" | "md";
  testIdPrefix?: string;
}) {
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);
  const icons = examFlowIcons(consultationId ? consultationCount : 0, exam);
  const iconClass = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  const goUpload = (kind: "paper" | "mathflex") => {
    // 완료·보냄이면 올리지 않고 결과 화면으로 간다(재시험은 /exams/new 한 화면 올리기로).
    const state = kind === "paper" ? icons.paper : icons.mathflex;
    if (state.action === "open" && exam) {
      router.push(`/exams/${exam.id}`);
      return;
    }
    if (state.action !== "upload" || !consultationId) return;
    const params = new URLSearchParams({ consultation: consultationId, kind, from });
    router.push(`/exams/new?${params.toString()}`);
  };

  const handleRequest = async () => {
    if (!exam) return;
    if (icons.request.action === "open") {
      router.push(`/exams/${exam.id}`);
      return;
    }
    const extra = exam.mathflexCount === 0 ? "\n(매쓰플랫 결과지는 아직 없습니다)" : "";
    if (!confirm(`시험지 ${exam.paperCount}장으로 분석을 요청할까요?${extra}\n요청한 뒤에는 파일을 더 올릴 수 없습니다.`)) {
      return;
    }
    setRequesting(true);
    try {
      const result = await requestExamAnalysis(exam.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("분석을 요청했습니다");
      router.refresh();
    } catch {
      toast.error("분석 요청 중 오류가 발생했습니다");
    } finally {
      setRequesting(false);
    }
  };

  const requestIcon = requesting ? (
    <Loader2 className={`${iconClass} animate-spin`} />
  ) : icons.request.tone === "done" ? (
    <FileCheck className={iconClass} />
  ) : (
    <ScanSearch className={iconClass} />
  );

  return (
    <>
      <FlowIconButton
        state={icons.paper}
        icon={<FileImage className={iconClass} />}
        onClick={() => goUpload("paper")}
        testId={testIdPrefix ? `${testIdPrefix}-paper` : undefined}
      />
      <FlowIconButton
        state={icons.mathflex}
        icon={<FileChartColumn className={iconClass} />}
        onClick={() => goUpload("mathflex")}
        testId={testIdPrefix ? `${testIdPrefix}-mathflex` : undefined}
      />
      <FlowIconButton
        state={icons.request}
        icon={requestIcon}
        busy={requesting}
        onClick={handleRequest}
        testId={testIdPrefix ? `${testIdPrefix}-request` : undefined}
      />
    </>
  );
}

export function toExamFlowSnapshot(
  exam: Pick<ExamAnalysis, "id" | "status" | "paper_paths" | "mathflex_paths">,
): ExamFlowSnapshot {
  return {
    id: exam.id,
    status: exam.status,
    paperCount: exam.paper_paths.length,
    mathflexCount: exam.mathflex_paths.length,
  };
}

// ─── 목록 ──────────────────────────────────────────────

/** 미등록 파생 행(설문 분석은 있는데 시험 행이 없는 학생). DB 행이 아니다. */
export interface UnregisteredExamRow {
  consultation_id: string;
  student_name: string;
  school: string | null;
  grade: string | null;
  subject: string | null;
}

export type ExamListRow =
  | { kind: "exam"; analysis: ExamAnalysis }
  | { kind: "unregistered"; row: UnregisteredExamRow };

const VIEW_BUTTON_CLASS =
  "inline-flex items-center rounded-md border px-2 py-1 text-xs font-bold whitespace-nowrap transition-colors";

/** 분석이 끝난 시험(결과지가 있는 상태). */
function isFinishedExam(status: ExamAnalysis["status"]): boolean {
  return status === "done" || status === "sent";
}

/**
 * 목록 줄 끝 버튼: 시험지 보기(상세 화면 — 카카오톡·링크 복사·알림톡·삭제는 거기서) + 결과지 보기(학부모 분석지, 새 탭).
 * 결과지는 분석이 끝나 링크가 있을 때만 보인다.
 */
function ExamViewButtons({ analysis }: { analysis: ExamAnalysis }) {
  const reportToken = analysis.report_token;
  const hasReport = !!reportToken && isFinishedExam(analysis.status);
  return (
    <>
      <Link
        href={`/exams/${analysis.id}`}
        onClick={stop}
        className={`${VIEW_BUTTON_CLASS} border-nk-line text-nk-ink-sub hover:bg-nk-sunken`}
      >
        시험지 보기
      </Link>
      {hasReport && (
        <a
          href={`/report/${reportToken}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={stop}
          className={`${VIEW_BUTTON_CLASS} border-nk-navy bg-nk-navy text-nk-navy-ink hover:bg-nk-navy-strong`}
        >
          결과지 보기
        </a>
      )}
    </>
  );
}

/**
 * 순서(page 에서 arrangeExamList 로 나눈다): headRows(진행 중 → 최근 30일 미등록) →
 * [이전 미등록 N명 보기] → tailRows(완료·보냄).
 */
export function ExamsListClient({
  headRows,
  olderRows = [],
  tailRows,
}: {
  headRows: ExamListRow[];
  olderRows?: ExamListRow[];
  tailRows: ExamListRow[];
}) {
  const router = useRouter();
  const [showOlder, setShowOlder] = useState(false);
  const total = headRows.length + olderRows.length + tailRows.length;

  const renderRow = (item: ExamListRow) => {
                if (item.kind === "unregistered") {
                  const r = item.row;
                  return (
                    <tr key={`u-${r.consultation_id}`} className="border-t border-nk-line-soft text-nk-ink-sub">
                      <td className="px-4 py-3">
                        <ExamStatusBadge status="unregistered" />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-nk-ink">{r.student_name}</span>
                        {(r.school || r.grade) && (
                          <span className="ml-1.5 text-xs text-nk-ink-hint">
                            {[r.school, r.grade].filter(Boolean).join(" ")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-nk-ink-hint">-</td>
                      <td className="hidden px-4 py-3 sm:table-cell">{r.subject ?? "-"}</td>
                      <td className="px-4 py-3 text-nk-ink-hint">-</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <ExamFlowIcons
                            consultationId={r.consultation_id}
                            consultationCount={1}
                            exam={null}
                            from="exams"
                            size="md"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                }
                const row = item.analysis;
                return (
                  <tr
                    key={row.id}
                    onClick={() => router.push(`/exams/${row.id}`)}
                    className="cursor-pointer border-t border-nk-line-soft text-nk-ink hover:bg-nk-hover"
                  >
                    <td className="px-4 py-3">
                      <ExamStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold">{row.student_name}</span>
                      {(row.school || row.grade) && (
                        <span className="ml-1.5 text-xs text-nk-ink-hint">
                          {[row.school, row.grade].filter(Boolean).join(" ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{row.exam_title}</td>
                    <td className="hidden px-4 py-3 text-nk-ink-sub sm:table-cell">{row.subject ?? "-"}</td>
                    <td className="px-4 py-3 text-nk-ink-sub">{formatExamDate(row.exam_date)}</td>
                    {/* 버튼 칸 클릭은 행 이동으로 번지지 않게 막는다. */}
                    <td className="px-4 py-2" onClick={stop}>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* 분석 전(작성 중·요청됨·분석 중)에만 올리기·분석 요청 아이콘. 완료 뒤에는 셋 다 같은
                            상세 화면으로 가서 헷갈린다(원장 지적 2026-10-03) — 시험지 보기·결과지 보기 두 개만. */}
                        {!isFinishedExam(row.status) && (
                          <ExamFlowIcons
                            consultationId={row.consultation_id}
                            consultationCount={row.consultation_id ? 1 : 0}
                            exam={toExamFlowSnapshot(row)}
                            from="exams"
                            size="md"
                          />
                        )}
                        <ExamViewButtons analysis={row} />
                      </div>
                    </td>
                  </tr>
                );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-nk-ink">입학테스트 분석</h1>
          <p className="mt-0.5 text-sm text-nk-ink-sub">
            입학테스트 시험지와 매쓰플랫 결과보고서를 올리면 분석 보고서를 만듭니다.
          </p>
        </div>
        <Button asChild>
          <Link href="/exams/new">
            <Upload className="mr-1 h-4 w-4" />
            새 시험지 올리기
          </Link>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-nk-line bg-nk-surface">
        {total === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
            <FileSearch className="h-8 w-8 text-nk-ink-hint" />
            <p className="text-sm text-nk-ink-sub">아직 올린 시험지가 없습니다.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-nk-sunken text-left text-xs text-nk-ink-hint">
              <tr>
                <th className="px-4 py-2.5 font-bold">상태</th>
                <th className="px-4 py-2.5 font-bold">학생</th>
                <th className="px-4 py-2.5 font-bold">시험명</th>
                <th className="hidden px-4 py-2.5 font-bold sm:table-cell">과목</th>
                <th className="px-4 py-2.5 font-bold">시험일</th>
                <th className="px-4 py-2.5 text-right font-bold">작업</th>
              </tr>
            </thead>
            <tbody>
              {headRows.map(renderRow)}
              {olderRows.length > 0 && (
                <tr className="border-t border-nk-line-soft">
                  <td colSpan={6} className="px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => setShowOlder((v) => !v)}
                      className="rounded-md px-2 py-1 text-xs font-bold text-nk-ink-sub hover:bg-nk-sunken"
                    >
                      {showOlder ? `이전 미등록 ${olderRows.length}명 접기` : `이전 미등록 ${olderRows.length}명 보기`}
                    </button>
                  </td>
                </tr>
              )}
              {showOlder && olderRows.map(renderRow)}
              {tailRows.map(renderRow)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
