"use server";

import { createClient } from "@/lib/supabase/server";

type DbRow = Record<string, unknown>;

export interface ClassRecommendation {
  class_id: string;
  class_name: string;
  teacher_name: string | null;
  score: number;
  ability_level: string | null;
  study_intensity: string | null;
  homework_volume: string | null;
  class_pace: string | null;
  main_textbook: string | null;
  current_page: number | null;
  main_total_pages: number | null;
  student_count: number;
  match_reasons: string[];
}

export interface RecommendationResult {
  success: boolean;
  error?: string;
  student_grade?: string;
  test_level?: string;
  recommendations?: ClassRecommendation[];
}

function nullableString(value: unknown): string | null {
  return value == null || value === "" ? null : String(value);
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 반 이름 접두사에서 학년 추출 — 진도현황(P-3)과 동일 규칙. 접두사 없으면 고3 */
function gradeFromClassName(className: string): string {
  const match = className.trimStart().match(/^(초|중|고)\s*([1-6])/);
  if (!match) return "고3";
  return `${match[1]}${match[2]}`;
}

/** 테스트 점수 → 상/중/하 등급 */
function testScoreLevel(score: number): "상" | "중" | "하" {
  if (score >= 80) return "상";
  if (score >= 50) return "중";
  return "하";
}

/** 설문 factor 평균 → 상/중/하 */
function factorLevel(avg: number): "상" | "중" | "하" {
  if (avg >= 3.5) return "상";
  if (avg >= 2.5) return "중";
  return "하";
}

const LEVEL_ORDER: Record<string, number> = { 상: 2, 중: 1, 하: 0 };

/** 두 등급의 거리 기반 점수: 일치 +max, 한 단계 차이 +1 */
function levelMatchScore(a: string | null, b: string | null, maxScore: number): number {
  if (!a || !b || !(a in LEVEL_ORDER) || !(b in LEVEL_ORDER)) return 0;
  const diff = Math.abs(LEVEL_ORDER[a] - LEVEL_ORDER[b]);
  if (diff === 0) return maxScore;
  if (diff === 1) return 1;
  return 0;
}

function pickFirst(value: unknown): DbRow | null {
  if (Array.isArray(value)) return (value[0] as DbRow) ?? null;
  if (value && typeof value === "object") return value as DbRow;
  return null;
}

export async function recommendClasses(
  analysisId: string,
  input: { test_score: number; test_date?: string; current_progress?: string }
): Promise<RecommendationResult> {
  try {
    if (!Number.isFinite(input.test_score) || input.test_score < 0 || input.test_score > 100) {
      return { success: false, error: "테스트 점수는 0~100 사이로 입력해주세요" };
    }

    const supabase = await createClient();

    // 1) 분석에서 학년·설문 factor 확보
    const { data: analysis, error: analysisError } = await supabase
      .from("analyses")
      .select("id, name, grade, score_self_directed, score_assignment, score_willingness")
      .eq("id", analysisId)
      .single();

    if (analysisError || !analysis) {
      return { success: false, error: "분석 정보를 찾을 수 없습니다" };
    }

    const studentGrade = nullableString(analysis.grade);
    if (!studentGrade) {
      return { success: false, error: "학생 학년 정보가 없어 추천할 수 없습니다 (설문의 학년을 확인해주세요)" };
    }

    // 2) 후보 반 + 진도/특성 + 재원 인원
    const { data: classes, error: classError } = await supabase
      .from("classes")
      .select("id, name, teacher_id, is_active, teachers:teacher_id(name), class_progress(*)")
      .eq("is_active", true);

    if (classError) {
      return { success: false, error: `반 정보 조회 실패: ${classError.message}` };
    }

    const { data: students } = await supabase
      .from("students")
      .select("class_name, is_active")
      .eq("is_active", true);

    const classCounts = new Map<string, number>();
    for (const s of students ?? []) {
      const cn = nullableString((s as DbRow).class_name);
      if (cn) classCounts.set(cn, (classCounts.get(cn) ?? 0) + 1);
    }

    // 3) 학년 일치 후보 필터
    const candidates = (classes ?? [])
      .map((row) => {
        const classRow = row as DbRow;
        const progress = pickFirst(classRow.class_progress);
        const teacherRow = pickFirst(classRow.teachers);
        const className = String(classRow.name ?? "");
        return {
          class_id: String(classRow.id ?? ""),
          class_name: className,
          teacher_name: nullableString(teacherRow?.name),
          grade_group: gradeFromClassName(className),
          ability_level: nullableString(progress?.ability_level),
          study_intensity: nullableString(progress?.study_intensity),
          homework_volume: nullableString(progress?.homework_volume),
          class_pace: nullableString(progress?.class_pace),
          main_textbook: nullableString(progress?.main_textbook),
          current_page: nullableNumber(progress?.current_page),
          main_total_pages: nullableNumber(progress?.main_total_pages),
          student_count: classCounts.get(className) ?? 0,
        };
      })
      .filter((c) => c.grade_group === studentGrade);

    if (candidates.length === 0) {
      return {
        success: false,
        error: `${studentGrade} 학년에 해당하는 활성 반이 없습니다`,
      };
    }

    // 4) 점수화
    const testLevel = testScoreLevel(input.test_score);
    const selfDirected = nullableNumber(analysis.score_self_directed);
    const assignment = nullableNumber(analysis.score_assignment);
    const willingness = nullableNumber(analysis.score_willingness);

    const homeworkFit =
      selfDirected != null && assignment != null ? factorLevel((selfDirected + assignment) / 2) : null;
    const intensityFit = willingness != null ? factorLevel(willingness) : null;

    const scored = candidates.map((c) => {
      let score = 0;
      const reasons: string[] = [];

      const abilityScore = levelMatchScore(testLevel, c.ability_level, 3);
      score += abilityScore;
      if (abilityScore >= 3) reasons.push(`테스트 등급(${testLevel})과 반 학습능력(${c.ability_level}) 일치`);
      else if (abilityScore > 0) reasons.push(`테스트 등급(${testLevel})과 반 학습능력(${c.ability_level}) 근접`);

      const homeworkScore = levelMatchScore(homeworkFit, c.homework_volume, 2);
      score += homeworkScore;
      if (homeworkScore >= 2 && homeworkFit) {
        reasons.push(`자기주도·과제수행 성향(${homeworkFit})과 반 학습량(${c.homework_volume}) 일치`);
      }

      const intensityScore = levelMatchScore(intensityFit, c.study_intensity, 2);
      score += intensityScore;
      if (intensityScore >= 2 && intensityFit) {
        reasons.push(`학습 의지(${intensityFit})와 반 학습강도(${c.study_intensity}) 일치`);
      }

      if (reasons.length === 0) {
        reasons.push(
          c.ability_level || c.study_intensity || c.homework_volume
            ? "학년 일치 (특성 적합도는 낮음)"
            : "학년 일치 (반 특성 미입력 — 진도현황에서 특성을 입력하면 정확도가 올라갑니다)"
        );
      }

      return { ...c, score, match_reasons: reasons };
    });

    // 5) 정렬: 점수 내림차순 → 동점이면 인원 적은 반 우선
    scored.sort((a, b) => b.score - a.score || a.student_count - b.student_count);

    const top = scored.slice(0, 3).map((c) => ({
      class_id: c.class_id,
      class_name: c.class_name,
      teacher_name: c.teacher_name,
      score: c.score,
      ability_level: c.ability_level,
      study_intensity: c.study_intensity,
      homework_volume: c.homework_volume,
      class_pace: c.class_pace,
      main_textbook: c.main_textbook,
      current_page: c.current_page,
      main_total_pages: c.main_total_pages,
      student_count: c.student_count,
      match_reasons: c.match_reasons,
    }));

    return {
      success: true,
      student_grade: studentGrade,
      test_level: testLevel,
      recommendations: top,
    };
  } catch (e) {
    console.error("[ClassRecommendation] 추천 실패:", e instanceof Error ? e.message : e);
    return { success: false, error: e instanceof Error ? e.message : "반 추천 실패" };
  }
}
