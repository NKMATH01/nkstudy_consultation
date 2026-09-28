"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSearch, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExamAnalysis, ExamAnalysisStatus } from "@/lib/actions/exam-analysis";

const STATUS_META: Record<ExamAnalysisStatus, { label: string; className: string }> = {
  pending: { label: "대기", className: "bg-nk-sunken text-nk-ink-sub ring-nk-line" },
  analyzing: { label: "분석중", className: "bg-nk-progress-soft text-nk-progress ring-nk-progress" },
  done: { label: "완료", className: "bg-nk-done-soft text-nk-done ring-nk-done" },
  sent: { label: "발송됨", className: "bg-nk-navy-soft text-nk-navy ring-nk-navy" },
};

export function ExamStatusBadge({ status }: { status: ExamAnalysisStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

export function formatExamDate(value: string | null): string {
  if (!value) return "-";
  return value.slice(0, 10);
}

export function ExamsListClient({ analyses }: { analyses: ExamAnalysis[] }) {
  const router = useRouter();

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

      <div className="overflow-hidden rounded-2xl border border-nk-line bg-nk-surface">
        {analyses.length === 0 ? (
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
              </tr>
            </thead>
            <tbody>
              {analyses.map((row) => (
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
                  <td className="hidden px-4 py-3 text-nk-ink-sub sm:table-cell">
                    {row.subject ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-nk-ink-sub">{formatExamDate(row.exam_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
