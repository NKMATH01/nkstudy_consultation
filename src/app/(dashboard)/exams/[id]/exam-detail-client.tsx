"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Clock, ExternalLink, ImageOff, Link2, Loader2, MessageCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { deleteExamAnalysis, type ExamAnalysis } from "@/lib/actions/exam-analysis";
import { shareViaKakao, KAKAO_BASE_URL } from "@/lib/kakao";
import { ExamStatusBadge, formatExamDate } from "../exams-list-client";

function PhotoGrid({
  title,
  urls,
  onOpen,
}: {
  title: string;
  urls: (string | null)[];
  onOpen: (url: string, label: string) => void;
}) {
  return (
    <section className="space-y-2 rounded-2xl border border-nk-line bg-nk-surface p-4">
      <h2 className="text-sm font-bold text-nk-ink">
        {title} <span className="text-xs font-normal text-nk-ink-hint">({urls.length}장)</span>
      </h2>
      {urls.length === 0 ? (
        <p className="text-xs text-nk-ink-hint">올린 사진이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {urls.map((url, i) =>
            url ? (
              <button
                key={i}
                type="button"
                onClick={() => onOpen(url, `${title} ${i + 1}`)}
                className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-nk-line-soft bg-nk-sunken"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 서명 URL이라 next/image 최적화 대상이 아니다 */}
                <img
                  src={url}
                  alt={`${title} ${i + 1}`}
                  className="h-full w-full object-cover transition group-hover:opacity-90"
                />
                <span className="absolute bottom-1 left-1 rounded bg-nk-surface px-1.5 text-[10px] font-bold text-nk-ink">
                  {i + 1}
                </span>
              </button>
            ) : (
              <div
                key={i}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg border border-nk-line-soft bg-nk-sunken text-[11px] text-nk-ink-hint"
              >
                <ImageOff className="h-4 w-4" />
                불러오지 못함
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}

export function ExamDetailClient({
  analysis,
  paperUrls,
  mathflexUrls,
}: {
  analysis: ExamAnalysis;
  paperUrls: (string | null)[];
  mathflexUrls: (string | null)[];
}) {
  const router = useRouter();
  const [zoom, setZoom] = useState<{ url: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("이 시험지와 올린 사진을 모두 삭제할까요? 되돌릴 수 없습니다.")) return;
    setDeleting(true);
    const result = await deleteExamAnalysis(analysis.id);
    if (!result.success) {
      toast.error(result.error);
      setDeleting(false);
      return;
    }
    toast.success("삭제했습니다");
    router.push("/exams");
  };

  const info: [string, string][] = [
    ["학생", analysis.student_name],
    ["학교·학년", [analysis.school, analysis.grade].filter(Boolean).join(" ") || "-"],
    ["시험명", analysis.exam_title],
    ["과목", analysis.subject ?? "-"],
    ["시험일", formatExamDate(analysis.exam_date)],
    ["올린 날", formatExamDate(analysis.created_at)],
  ];
  if (analysis.note) info.push(["메모", analysis.note]);

  // 분석지 링크는 exam-push 가 올릴 때 이미 만들어 둔다. 여기서는 그 토큰을 그대로 쓴다.
  const reportToken = analysis.report_token;
  const hasReport = !!reportToken && (analysis.status === "done" || analysis.status === "sent");
  const reportUrl = reportToken ? `${KAKAO_BASE_URL}/report/${reportToken}` : "";
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (!reportToken) return;
    setSharing(true);
    try {
      await shareViaKakao({
        title: `${analysis.student_name} 입학테스트 분석`,
        description: "NK학원 입학테스트 답안 분석 결과입니다.",
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

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/exams">
              <ArrowLeft className="h-4 w-4" />
              목록
            </Link>
          </Button>
          <h1 className="text-xl font-extrabold text-nk-ink">{analysis.exam_title}</h1>
          <ExamStatusBadge status={analysis.status} />
        </div>
        <div className="flex items-center gap-2">
          {hasReport && (
            <>
              <Button asChild size="sm">
                <Link href={`/report/${reportToken}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  보고서 보기
                </Link>
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleShare} disabled={sharing}>
                <MessageCircle className={`h-4 w-4 ${sharing ? "animate-pulse" : ""}`} />
                카카오톡
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                <Link2 className="h-4 w-4" />
                링크 복사
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="border-nk-late text-nk-late hover:bg-nk-late-soft"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            삭제
          </Button>
        </div>
      </div>

      {(analysis.status === "pending" || analysis.status === "analyzing") && (
        <div className="flex items-start gap-3 rounded-md border border-nk-line bg-nk-sunken px-4 py-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-nk-ink-sub" />
          <div className="space-y-1 text-sm leading-relaxed">
            <p className="font-bold text-nk-ink">
              {analysis.status === "pending" ? "사진이 올라갔습니다. 분석을 기다리는 중입니다." : "지금 분석하고 있습니다."}
            </p>
            <p className="text-nk-ink-sub">
              분석이 끝나면 이 화면에 보고서 보기·카카오톡·링크 복사 버튼이 나타납니다. 따로 하실 일은 없습니다.
            </p>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-nk-line bg-nk-surface p-4">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {info.map(([label, value]) => (
            <div key={label} className="flex gap-3">
              <dt className="w-20 shrink-0 text-nk-ink-hint">{label}</dt>
              <dd className="text-nk-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <PhotoGrid title="시험지" urls={paperUrls} onOpen={(url, label) => setZoom({ url, label })} />
      <PhotoGrid
        title="매쓰플랫 결과보고서"
        urls={mathflexUrls}
        onOpen={(url, label) => setZoom({ url, label })}
      />

      <Dialog open={zoom !== null} onOpenChange={(open) => !open && setZoom(null)}>
        <DialogContent className="max-h-[95vh] overflow-auto bg-nk-surface sm:max-w-4xl">
          <DialogTitle className="text-nk-ink">{zoom?.label}</DialogTitle>
          {zoom && (
            // eslint-disable-next-line @next/next/no-img-element -- 서명 URL 원본 보기
            <img src={zoom.url} alt={zoom.label} className="h-auto w-full" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
