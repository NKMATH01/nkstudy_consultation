"use server";

import { createClient } from "@/lib/supabase/server";
import { getProgressBoard } from "@/lib/actions/progress";
import { computeExpectedPercent } from "@/lib/progress-expected";
import type { PlacementClass } from "@/lib/class-placement";

/**
 * 반 배정 도우미 데이터 — 진도 현황 화면과 같은 로더(getProgressBoard)를 재사용한다.
 * classes(요일=description)·class_progress·class_curriculum_progress·학생 수(students.class_name 기준)·교재 이력.
 * 예상 진도는 computeExpectedPercent(진도 현황과 같은 계산).
 */
export async function getClassPlacementData(): Promise<{ classes: PlacementClass[]; error: string | null }> {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { classes: [], error: "인증이 필요합니다" };

    const board = await getProgressBoard();
    const classes = board.rows.map((row): PlacementClass => {
      const p = row.progress;
      const actualPercent =
        p?.current_page != null && p.main_total_pages != null && p.main_total_pages > 0
          ? Math.max(0, Math.min(100, Math.round((p.current_page / p.main_total_pages) * 100)))
          : null;
      const expected = p
        ? computeExpectedPercent({
            targetEndDate: p.target_end_date,
            targetPercent: p.target_percent,
            history: row.textbook_history,
            mainStartedOn: p.main_started_on,
            progressCreatedAt: p.created_at,
          })
        : null;
      return {
        classId: row.class_id,
        className: row.class_name,
        teacherName: row.teacher_name,
        classDays: row.class_days,
        classTime: row.class_time,
        studentCount: row.actual_student_count,
        abilityLevel: p?.ability_level ?? null,
        classPace: p?.class_pace ?? null,
        mainTextbook: p?.main_textbook ?? null,
        currentMajorUnit: p?.current_major_unit ?? null,
        currentMinorUnit: p?.current_minor_unit ?? null,
        actualPercent,
        expectedPercent: expected?.percent ?? null,
        passedUnits: row.curriculum.filter((c) => c.status === "완료").map((c) => c.unit),
        ongoingUnits: row.curriculum.filter((c) => c.status !== "완료").map((c) => c.unit),
      };
    });
    return { classes, error: board.error };
  } catch (e) {
    console.error("[class-placement] 반 정보 조회 실패:", e instanceof Error ? e.message : e);
    return { classes: [], error: "반 정보를 불러오지 못했습니다" };
  }
}
