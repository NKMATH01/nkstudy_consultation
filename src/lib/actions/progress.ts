"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentPageSchema, progressFormSchema, type ProgressFormValues } from "@/lib/validations/progress";
import type { ClassProgress, ClassProgressLog, CurriculumProgress, Teacher, TextbookHistory } from "@/types";
import { curriculumUnitOrder, GRADES } from "@/types";
import type { TextbookHistoryFormValues, CurriculumProgressFormValues } from "@/lib/validations/progress";
import { textbookHistorySchema, curriculumProgressSchema } from "@/lib/validations/progress";

type DbRow = Record<string, unknown>;

export interface ProgressTeacherInfo {
  id: string | null;
  name: string;
  role: Teacher["role"];
}

export interface GradeCount {
  grade: string;
  count: number;
}

export interface ProgressBoardRow {
  class_id: string;
  class_name: string;
  teacher_id: string | null;
  teacher_name: string | null;
  target_grade: string | null;
  class_days: string | null;
  class_time: string | null;
  clinic_time: string | null;
  actual_student_count: number;
  student_count: number;
  student_names: string[];
  grade_breakdown: GradeCount[];
  progress: ClassProgress | null;
  textbook_history: TextbookHistory[];
  curriculum: CurriculumProgress[];
  recent_logs: ClassProgressLog[];
  weekly_progress: number | null;
}

export interface ProgressBoardResult {
  rows: ProgressBoardRow[];
  error: string | null;
}

const LIMITED_ROLES = new Set<Teacher["role"]>(["teacher", "clinic"]);
const FULL_ACCESS_ROLES = new Set<Teacher["role"]>([
  "admin",
  "director",
  "principal",
  "manager",
  "staff",
]);

function nullableString(value: unknown): string | null {
  return value == null || value === "" ? null : String(value);
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapProgress(row: DbRow): ClassProgress {
  return {
    id: String(row.id ?? ""),
    class_id: String(row.class_id ?? ""),
    student_count: nullableNumber(row.student_count),
    main_textbook: nullableString(row.main_textbook),
    main_total_pages: nullableNumber(row.main_total_pages),
    current_page: nullableNumber(row.current_page),
    sub_textbook: nullableString(row.sub_textbook),
    next_textbook: nullableString(row.next_textbook),
    next_start_plan: nullableString(row.next_start_plan),
    current_plan: nullableString(row.current_plan),
    note: nullableString(row.note),
    ability_level: nullableString(row.ability_level),
    study_intensity: nullableString(row.study_intensity),
    homework_volume: nullableString(row.homework_volume),
    class_pace: nullableString(row.class_pace),
    next_start_date: nullableString(row.next_start_date),
    expected_months: nullableNumber(row.expected_months),
    expected_weeks: nullableNumber(row.expected_weeks),
    target_end_date: nullableString(row.target_end_date),
    updated_by: nullableString(row.updated_by),
    progress_updated_at: nullableString(row.progress_updated_at),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapTextbookHistory(row: DbRow): TextbookHistory {
  return {
    id: String(row.id ?? ""),
    class_id: String(row.class_id ?? ""),
    textbook: String(row.textbook ?? ""),
    started_on: nullableString(row.started_on),
    finished_on: nullableString(row.finished_on),
    note: nullableString(row.note),
    created_at: String(row.created_at ?? ""),
  };
}

function mapCurriculum(row: DbRow): CurriculumProgress {
  return {
    id: String(row.id ?? ""),
    class_id: String(row.class_id ?? ""),
    unit: String(row.unit ?? ""),
    level: nullableString(row.level),
    status: String(row.status ?? "진행중"),
    note: nullableString(row.note),
    created_at: String(row.created_at ?? ""),
  };
}

/** 반명/대상학년에서 학교급(초/중/고) 추출 — 학년 정규화에 사용 */
function detectSchool(className: string, targetGrade: string | null): "초" | "중" | "고" | null {
  for (const src of [className, targetGrade ?? ""]) {
    const m = src.match(/[초중고]/);
    if (m) return m[0] as "초" | "중" | "고";
  }
  return null;
}

/**
 * 학년 표기 정규화. 실제 데이터가 "고2"/"2"/맨숫자 등으로 뒤섞여 있어
 * 같은 학년을 하나로 합치기 위함. 학교급 범위를 벗어난 맨숫자는 원본 유지.
 */
function normalizeGrade(raw: string | null, school: "초" | "중" | "고" | null): string | null {
  const g = (raw ?? "").trim();
  if (!g) return null;
  const pre = g.match(/^(초|중|고)\s*([1-9])/);
  if (pre) return `${pre[1]}${pre[2]}`;
  const bare = g.match(/^([1-9])$/);
  if (bare && school) {
    const n = Number(bare[1]);
    if (school === "고" && n >= 1 && n <= 3) return `고${n}`;
    if (school === "중" && n >= 1 && n <= 3) return `중${n}`;
    if (school === "초" && n >= 1 && n <= 6) return `초${n}`;
  }
  return g;
}

/** 학년 구성 정렬: GRADES(초3~고3) 순서, 미매칭은 뒤로 */
function gradeOrderIndex(grade: string): number {
  const idx = (GRADES as readonly string[]).indexOf(grade);
  return idx === -1 ? GRADES.length : idx;
}

function mapLog(row: DbRow): ClassProgressLog {
  return {
    id: String(row.id ?? ""),
    progress_id: String(row.progress_id ?? ""),
    page: Number(row.page ?? 0),
    recorded_by: nullableString(row.recorded_by),
    recorded_at: String(row.recorded_at ?? ""),
  };
}

function pickProgress(value: unknown): ClassProgress | null {
  if (Array.isArray(value)) {
    const first = value[0] as DbRow | undefined;
    return first ? mapProgress(first) : null;
  }
  if (value && typeof value === "object") return mapProgress(value as DbRow);
  return null;
}

function getTeacherName(value: unknown): string | null {
  if (Array.isArray(value)) return nullableString((value[0] as DbRow | undefined)?.name);
  if (value && typeof value === "object") return nullableString((value as DbRow).name);
  return null;
}

function weeklyProgress(logs: ClassProgressLog[]): number | null {
  if (logs.length < 2) return null;
  return logs[0].page - logs[1].page;
}

function cleanText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toProgressPayload(classId: string, data: ProgressFormValues, updatedBy: string): DbRow {
  return {
    class_id: classId,
    main_textbook: cleanText(data.main_textbook),
    main_total_pages: data.main_total_pages ?? null,
    current_page: data.current_page ?? null,
    sub_textbook: cleanText(data.sub_textbook),
    next_textbook: cleanText(data.next_textbook),
    next_start_date: cleanText(data.next_start_date),
    expected_months: data.expected_months ?? null,
    expected_weeks: data.expected_weeks ?? null,
    target_end_date: cleanText(data.target_end_date),
    current_plan: cleanText(data.current_plan),
    note: cleanText(data.note),
    ability_level: data.ability_level ?? null,
    study_intensity: data.study_intensity ?? null,
    homework_volume: data.homework_volume ?? null,
    class_pace: data.class_pace ?? null,
    updated_by: updatedBy,
    progress_updated_at: data.current_page != null ? new Date().toISOString() : null,
  };
}

async function fetchRecentLogs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  progressId: string
): Promise<ClassProgressLog[]> {
  const { data, error } = await supabase
    .from("class_progress_logs")
    .select("*")
    .eq("progress_id", progressId)
    .order("recorded_at", { ascending: false })
    .limit(2);

  if (error) return [];
  return (data ?? []).map((row) => mapLog(row as DbRow));
}

async function getCurrentProgressTeacherWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<ProgressTeacherInfo | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  if (user.email.endsWith("@nk.local")) {
    const digits = user.email.replace("@nk.local", "").replace(/\D/g, "");
    let formatted = digits;
    if (digits.length === 11) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }

    const { data } = await supabase
      .from("teachers")
      .select("id, name, role")
      .or(`phone.eq.${digits},phone.eq.${formatted}`)
      .or("is_active.is.null,is_active.eq.true") // 퇴사자 제외
      .limit(1)
      .single();

    if (data) {
      return {
        id: String(data.id ?? ""),
        name: String(data.name ?? "선생님"),
        role: (data.role ?? null) as Teacher["role"],
      };
    }
  }

  if (user.email === "admin@nk.com") {
    return { id: null, name: "관리자", role: "admin" };
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "admin") {
      return {
        id: null,
        name: String(profile.name ?? "관리자"),
        role: "admin",
      };
    }
  } catch {
    // profiles 테이블이 없는 배포 환경도 허용한다.
  }

  return null;
}

async function assertCanEditClass(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classId: string
): Promise<{ ok: true; teacher: ProgressTeacherInfo } | { ok: false; error: string }> {
  const teacher = await getCurrentProgressTeacherWithClient(supabase);
  if (!teacher) return { ok: false, error: "로그인이 필요합니다" };

  if (!FULL_ACCESS_ROLES.has(teacher.role) && !LIMITED_ROLES.has(teacher.role)) {
    return { ok: false, error: "수정 권한이 없습니다" };
  }

  const { data: classRow, error } = await supabase
    .from("classes")
    .select("id, teacher_id")
    .eq("id", classId)
    .single();

  if (error || !classRow) {
    return { ok: false, error: "반 정보를 찾을 수 없습니다" };
  }

  if (LIMITED_ROLES.has(teacher.role) && nullableString(classRow.teacher_id) !== teacher.id) {
    return { ok: false, error: "본인 담당 반만 수정할 수 있습니다" };
  }

  return { ok: true, teacher };
}

export async function getCurrentProgressTeacher(): Promise<ProgressTeacherInfo | null> {
  try {
    const supabase = await createClient();
    return await getCurrentProgressTeacherWithClient(supabase);
  } catch {
    return null;
  }
}

export async function getProgressBoard(): Promise<ProgressBoardResult> {
  const supabase = await createClient();

  // description = 요일(class_days), class_time/clinic_time = 시간표 (표시 전용)
  const { data: classes, error: classError } = await supabase
    .from("classes")
    .select("id, name, target_grade, teacher_id, is_active, description, class_time, clinic_time, teachers:teacher_id(name), class_progress(*)")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (classError) {
    console.error("[Progress] class_progress board query failed:", classError.message);
    return { rows: [], error: classError.message };
  }

  // 반명 → 학교급 (학년 정규화에 사용)
  const classSchoolByName = new Map<string, "초" | "중" | "고" | null>();
  for (const row of classes ?? []) {
    const classRow = row as DbRow;
    const className = String(classRow.name ?? "");
    if (className) {
      classSchoolByName.set(className, detectSchool(className, nullableString(classRow.target_grade)));
    }
  }

  const { data: students, error: studentError } = await supabase
    .from("students")
    .select("id, name, class_name, grade, is_active")
    .eq("is_active", true);

  if (studentError) {
    console.error("[Progress] student count query failed:", studentError.message);
  }

  const classCounts = new Map<string, number>();
  const classStudentNames = new Map<string, string[]>();
  const classGradeCounts = new Map<string, Map<string, number>>();
  for (const student of students ?? []) {
    const className = nullableString((student as DbRow).class_name);
    if (!className) continue;
    classCounts.set(className, (classCounts.get(className) ?? 0) + 1);
    const studentName = nullableString((student as DbRow).name);
    if (studentName) {
      classStudentNames.set(className, [...(classStudentNames.get(className) ?? []), studentName]);
    }
    const grade = normalizeGrade(
      nullableString((student as DbRow).grade),
      classSchoolByName.get(className) ?? null
    );
    if (grade) {
      const gradeMap = classGradeCounts.get(className) ?? new Map<string, number>();
      gradeMap.set(grade, (gradeMap.get(grade) ?? 0) + 1);
      classGradeCounts.set(className, gradeMap);
    }
  }
  for (const names of classStudentNames.values()) {
    names.sort((a, b) => a.localeCompare(b, "ko"));
  }

  const buildGradeBreakdown = (className: string): GradeCount[] =>
    [...(classGradeCounts.get(className)?.entries() ?? [])]
      .map(([grade, count]) => ({ grade, count }))
      .sort((a, b) => gradeOrderIndex(a.grade) - gradeOrderIndex(b.grade) || a.grade.localeCompare(b.grade, "ko"));

  const baseRows = (classes ?? []).map((row) => {
    const classRow = row as DbRow;
    const progress = pickProgress(classRow.class_progress);
    const className = String(classRow.name ?? "");
    const actualStudentCount = classCounts.get(className) ?? 0;
    return {
      class_id: String(classRow.id ?? ""),
      class_name: className,
      teacher_id: nullableString(classRow.teacher_id),
      teacher_name: getTeacherName(classRow.teachers),
      target_grade: nullableString(classRow.target_grade),
      class_days: nullableString(classRow.description),
      class_time: nullableString(classRow.class_time),
      clinic_time: nullableString(classRow.clinic_time),
      actual_student_count: actualStudentCount,
      student_count: actualStudentCount,
      student_names: classStudentNames.get(className) ?? [],
      grade_breakdown: buildGradeBreakdown(className),
      progress,
      textbook_history: [] as TextbookHistory[],
      curriculum: [] as CurriculumProgress[],
      recent_logs: [] as ClassProgressLog[],
      weekly_progress: null as number | null,
    };
  });

  // 교재 이력 일괄 조회 (반별 누적, 최신순)
  const classIds = baseRows.map((row) => row.class_id);
  if (classIds.length > 0) {
    const { data: histories, error: historyError } = await supabase
      .from("class_textbook_history")
      .select("*")
      .in("class_id", classIds)
      .order("finished_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (historyError) {
      console.error("[Progress] textbook history query failed:", historyError.message);
    } else {
      const historyMap = new Map<string, TextbookHistory[]>();
      for (const h of histories ?? []) {
        const mapped = mapTextbookHistory(h as DbRow);
        historyMap.set(mapped.class_id, [...(historyMap.get(mapped.class_id) ?? []), mapped]);
      }
      for (const row of baseRows) {
        row.textbook_history = historyMap.get(row.class_id) ?? [];
      }
    }

    // 수업 진행 단원 일괄 조회 (반별 누적, canonical 정렬)
    const { data: curriculums, error: curriculumError } = await supabase
      .from("class_curriculum_progress")
      .select("*")
      .in("class_id", classIds);

    if (curriculumError) {
      console.error("[Progress] curriculum query failed:", curriculumError.message);
    } else {
      const curriculumMap = new Map<string, CurriculumProgress[]>();
      for (const c of curriculums ?? []) {
        const mapped = mapCurriculum(c as DbRow);
        curriculumMap.set(mapped.class_id, [...(curriculumMap.get(mapped.class_id) ?? []), mapped]);
      }
      for (const list of curriculumMap.values()) {
        list.sort(
          (a, b) =>
            curriculumUnitOrder(a.unit) - curriculumUnitOrder(b.unit) ||
            a.created_at.localeCompare(b.created_at)
        );
      }
      for (const row of baseRows) {
        row.curriculum = curriculumMap.get(row.class_id) ?? [];
      }
    }
  }

  const progressIds = baseRows
    .map((row) => row.progress?.id)
    .filter((id): id is string => Boolean(id));

  if (progressIds.length === 0) {
    return { rows: baseRows, error: studentError?.message ?? null };
  }

  const { data: logs, error: logsError } = await supabase
    .from("class_progress_logs")
    .select("*")
    .in("progress_id", progressIds)
    .order("recorded_at", { ascending: false });

  if (logsError) {
    console.error("[Progress] logs query failed:", logsError.message);
    return { rows: baseRows, error: logsError.message };
  }

  const logsByProgress = new Map<string, ClassProgressLog[]>();
  for (const row of logs ?? []) {
    const log = mapLog(row as DbRow);
    const current = logsByProgress.get(log.progress_id) ?? [];
    if (current.length < 2) {
      current.push(log);
      logsByProgress.set(log.progress_id, current);
    }
  }

  return {
    rows: baseRows.map((row) => {
      const recentLogs = row.progress ? logsByProgress.get(row.progress.id) ?? [] : [];
      return {
        ...row,
        recent_logs: recentLogs,
        weekly_progress: weeklyProgress(recentLogs),
      };
    }),
    error: studentError?.message ?? null,
  };
}

export async function upsertProgress(classId: string, data: ProgressFormValues) {
  try {
    const parsed = progressFormSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const supabase = await createClient();
    const permission = await assertCanEditClass(supabase, classId);
    if (!permission.ok) return { success: false, error: permission.error };

    const { data: progress, error } = await supabase
      .from("class_progress")
      .upsert(toProgressPayload(classId, parsed.data, permission.teacher.name), { onConflict: "class_id" })
      .select("*")
      .single();

    if (error) return { success: false, error: error.message };

    const mapped = mapProgress(progress as DbRow);
    const recentLogs = await fetchRecentLogs(supabase, mapped.id);

    revalidatePath("/progress");
    return {
      success: true,
      progress: mapped,
      recent_logs: recentLogs,
      weekly_progress: weeklyProgress(recentLogs),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "진도 저장 실패";
    return { success: false, error: msg };
  }
}

export async function updateCurrentPage(classId: string, page: number) {
  try {
    const parsed = currentPageSchema.safeParse({ page });
    if (!parsed.success || parsed.data.page == null) {
      return { success: false, error: parsed.success ? "현재 페이지를 입력해주세요" : parsed.error.issues[0].message };
    }

    const supabase = await createClient();
    const permission = await assertCanEditClass(supabase, classId);
    if (!permission.ok) return { success: false, error: permission.error };

    const { data: existing, error: existingError } = await supabase
      .from("class_progress")
      .select("id, main_total_pages")
      .eq("class_id", classId)
      .maybeSingle();

    if (existingError) return { success: false, error: existingError.message };

    const totalPages = nullableNumber(existing?.main_total_pages);
    if (totalPages != null && parsed.data.page > totalPages) {
      return { success: false, error: "현재 페이지는 전체 페이지보다 클 수 없습니다" };
    }

    const now = new Date().toISOString();
    const { data: progress, error } = await supabase
      .from("class_progress")
      .upsert(
        {
          class_id: classId,
          current_page: parsed.data.page,
          progress_updated_at: now,
          updated_by: permission.teacher.name,
        },
        { onConflict: "class_id" }
      )
      .select("*")
      .single();

    if (error) return { success: false, error: error.message };

    const mapped = mapProgress(progress as DbRow);
    const { error: logError } = await supabase.from("class_progress_logs").insert({
      progress_id: mapped.id,
      page: parsed.data.page,
      recorded_by: permission.teacher.name,
    });

    if (logError) return { success: false, error: logError.message };

    const recentLogs = await fetchRecentLogs(supabase, mapped.id);

    revalidatePath("/progress");
    return {
      success: true,
      progress: mapped,
      recent_logs: recentLogs,
      weekly_progress: weeklyProgress(recentLogs),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "현재 페이지 저장 실패";
    return { success: false, error: msg };
  }
}

// ========== 교재 이력 (과거 교재 누적) ==========

export async function addTextbookHistory(classId: string, data: TextbookHistoryFormValues) {
  try {
    const parsed = textbookHistorySchema.safeParse(data);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }

    const supabase = await createClient();
    const permission = await assertCanEditClass(supabase, classId);
    if (!permission.ok) return { success: false as const, error: permission.error };

    const { data: inserted, error } = await supabase
      .from("class_textbook_history")
      .insert({
        class_id: classId,
        textbook: parsed.data.textbook.trim(),
        started_on: cleanText(parsed.data.started_on),
        finished_on: cleanText(parsed.data.finished_on),
        note: cleanText(parsed.data.note),
      })
      .select("*")
      .single();

    if (error) return { success: false as const, error: error.message };

    revalidatePath("/progress");
    return { success: true as const, history: mapTextbookHistory(inserted as DbRow) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "교재 이력 추가 실패";
    return { success: false as const, error: msg };
  }
}

export async function deleteTextbookHistory(historyId: string) {
  try {
    const supabase = await createClient();

    const { data: history, error: fetchError } = await supabase
      .from("class_textbook_history")
      .select("id, class_id")
      .eq("id", historyId)
      .single();

    if (fetchError || !history) {
      return { success: false as const, error: "교재 이력을 찾을 수 없습니다" };
    }

    const permission = await assertCanEditClass(supabase, String(history.class_id));
    if (!permission.ok) return { success: false as const, error: permission.error };

    const { error } = await supabase.from("class_textbook_history").delete().eq("id", historyId);
    if (error) return { success: false as const, error: error.message };

    revalidatePath("/progress");
    return { success: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "교재 이력 삭제 실패";
    return { success: false as const, error: msg };
  }
}

// ========== 수업 진행 단원 (반별 누적) ==========

export async function upsertCurriculum(classId: string, data: CurriculumProgressFormValues) {
  try {
    const parsed = curriculumProgressSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }

    const supabase = await createClient();
    const permission = await assertCanEditClass(supabase, classId);
    if (!permission.ok) return { success: false as const, error: permission.error };

    const { data: saved, error } = await supabase
      .from("class_curriculum_progress")
      .upsert(
        {
          class_id: classId,
          unit: parsed.data.unit,
          level: parsed.data.level ?? null,
          status: parsed.data.status,
          note: cleanText(parsed.data.note),
        },
        { onConflict: "class_id,unit" }
      )
      .select("*")
      .single();

    if (error) return { success: false as const, error: error.message };

    revalidatePath("/progress");
    return { success: true as const, curriculum: mapCurriculum(saved as DbRow) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "단원 저장 실패";
    return { success: false as const, error: msg };
  }
}

export async function deleteCurriculum(curriculumId: string) {
  try {
    const supabase = await createClient();

    const { data: curriculum, error: fetchError } = await supabase
      .from("class_curriculum_progress")
      .select("id, class_id")
      .eq("id", curriculumId)
      .single();

    if (fetchError || !curriculum) {
      return { success: false as const, error: "단원 정보를 찾을 수 없습니다" };
    }

    const permission = await assertCanEditClass(supabase, String(curriculum.class_id));
    if (!permission.ok) return { success: false as const, error: permission.error };

    const { error } = await supabase.from("class_curriculum_progress").delete().eq("id", curriculumId);
    if (error) return { success: false as const, error: error.message };

    revalidatePath("/progress");
    return { success: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "단원 삭제 실패";
    return { success: false as const, error: msg };
  }
}
