import { BookOpenCheck } from "lucide-react";
import { ProgressBoardClient } from "@/components/progress/progress-board-client";
import { getCurrentProgressTeacher, getProgressBoard } from "@/lib/actions/progress";
import { checkPagePermission } from "@/lib/check-permission";

export default async function ProgressPage() {
  await checkPagePermission("/progress");
  const [board, currentTeacher] = await Promise.all([
    getProgressBoard(),
    getCurrentProgressTeacher(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-soft) 100%)" }}
        >
          <BookOpenCheck className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1
            className="text-xl font-extrabold"
            style={{ color: "#0F172A", letterSpacing: "-0.02em", marginBottom: "2px" }}
          >
            진도 현황
          </h1>
          <p className="text-[12.5px]" style={{ color: "#64748B" }}>
            반별 교재 진도와 학습 특성을 한눈에 — 신입생 반 배정의 기준 데이터입니다. (모든 강사 열람 가능)
          </p>
        </div>
      </div>

      <ProgressBoardClient
        initialRows={board.rows}
        currentTeacher={currentTeacher}
        initialError={board.error}
      />
    </div>
  );
}
