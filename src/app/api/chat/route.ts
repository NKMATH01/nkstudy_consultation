// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { streamText, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { env } from "@/lib/env";

// 대표/원장 역할 확인을 위한 헬퍼
async function getCallerRole(): Promise<{
  name: string;
  role: string | null;
} | null> {
  const supabase = await createClient();
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
      .select("name, role")
      .or(`phone.eq.${digits},phone.eq.${formatted}`)
      .limit(1)
      .single();
    return data ? { name: data.name, role: data.role } : null;
  }

  // profiles 기반 (admin@nk.com 등)
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("id", user.id)
    .single();
  if (profile?.role === "admin") return { name: profile.name, role: "admin" };
  return null;
}

// Service Role 클라이언트 (RLS 우회)
function getAdminSupabase() {
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const SYSTEM_PROMPT = `당신은 NK EDUCATION 학원의 상담관리 시스템 AI 어시스턴트입니다.
대표와 원장만 사용할 수 있는 전용 도구입니다.

## 시스템 개요
NK EDUCATION은 수학/영어 학원으로, 이 시스템은 상담, 설문, AI분석, 등록안내, 학생/강사/반 관리를 통합 관리합니다.

## 테이블 구조

### consultations (상담)
- id, name(학생명), school, grade, parent_phone
- consult_date(상담일), consult_time, consult_type(유선상담/대면상담)
- subject(과목), location(지점)
- status: pending(대기) → active(진행중) → completed(완료) / cancelled(취소)
- result_status: none(미결정) → registered(등록) / hold(보류) / other(기타)
- attitude, willingness, parent_level, student_level (상담 평가)
- plan_date(등록예정일), plan_class(배정반)
- memo, requests, analysis_id, registration_id
- created_at, updated_at

### students (재원생)
- id, name, school, grade, phone, parent_phone
- class_name(소속반), teacher_id, clinic_teacher_id
- teacher_name, is_active, memo, registration_date
- created_at, updated_at

### teachers (강사)
- id, name, phone, building(과목), role(teacher/clinic/admin/director/principal/manager/staff)
- is_active, allowed_menus, created_at

### classes (반)
- id, name, teacher_id, description(수업요일), class_time, clinic_time
- target_grade, location, weekly_test_time, is_active

### surveys (설문 - 35문항)
- id, name, school, grade, student_phone, parent_phone
- q1~q35 (1~5점 척도)
- factor_attitude, factor_self_directed, factor_assignment, factor_willingness, factor_social, factor_management, factor_emotion (7-Factor 점수)
- study_core, problem_self, dream (주관식)
- analysis_id, created_at

### analyses (AI 성향분석)
- id, survey_id, name, school, grade
- score_attitude~score_management (AI 재채점)
- comment_attitude~comment_emotion (AI 코멘트)
- student_type(학생유형), summary, strengths, weaknesses, solutions
- report_html, created_at

### registrations (등록안내)
- id, analysis_id, name, school, grade
- assigned_class, teacher, subject
- tuition_fee, report_html, created_at

### bookings (상담예약)
- id, branch(gojan-math/gojan-eng/zai-both), consult_type(phone/inperson)
- booking_date, booking_hour(13~20), student_name, parent_name, phone
- paid, created_at

### withdrawals (퇴원생)
- id, name, school, grade, subject, class_name, teacher
- enrollment_start, enrollment_end, duration_months
- reason_category, comeback_possibility
- student_opinion, parent_opinion, teacher_opinion
- created_at

## 7-Factor 설문 모델
- 수업태도(attitude): Q6~Q10
- 자기주도성(self_directed): Q11,14,15,18,19,29
- 과제수행력(assignment): Q12,13,16,17,34,35
- 학업의지(willingness): Q21~Q25
- 사회성(social): Q1,2,4,5
- 관리선호(management): Q3,20,28,30
- 심리·자신감(emotion): Q26,27,31,32,33

## 응답 규칙
1. 한국어로 답변하세요.
2. 데이터를 조회할 때는 반드시 도구를 사용하세요. 추측하지 마세요.
3. 숫자나 통계를 말할 때는 정확한 데이터를 기반으로 하세요.
4. 표 형식이 적절하면 마크다운 표를 사용하세요.
5. 데이터 수정/생성 요청 시 변경 내용을 먼저 확인받고 실행하세요.
6. 오늘 날짜: ${new Date().toISOString().split("T")[0]}`;

const ALLOWED_TABLES = [
  "consultations",
  "students",
  "teachers",
  "classes",
  "surveys",
  "analyses",
  "registrations",
  "bookings",
  "blocked_slots",
  "withdrawals",
];

export async function POST(req: Request) {
  // 1. 인증 + 역할 확인
  const caller = await getCallerRole();
  if (!caller) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!["director", "principal", "admin"].includes(caller.role ?? "")) {
    return new Response("Forbidden", { status: 403 });
  }

  const { messages } = await req.json();
  const db = getAdminSupabase();

  // 2. Claude Sonnet 스트리밍 호출
  const result = streamText({
    model: anthropic("claude-sonnet-4-5-20241022"),
    system: SYSTEM_PROMPT,
    messages,
    maxOutputTokens: 4096,
    tools: {
      // ── 범용 조회 도구 ──
      query_table: tool({
        description:
          "Supabase 테이블에서 데이터를 조회합니다. select로 컬럼을 지정하고, filters로 조건을 걸고, order로 정렬합니다.",
        parameters: z.object({
          table: z
            .enum(ALLOWED_TABLES as [string, ...string[]])
            .describe("조회할 테이블명"),
          select: z
            .string()
            .optional()
            .describe("선택할 컬럼 (Supabase select 문법, 예: 'name, phone, class_name'). 생략 시 전체 컬럼"),
          filters: z
            .array(
              z.object({
                column: z.string(),
                operator: z
                  .enum(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in"])
                  .describe("비교 연산자"),
                value: z.string().describe("비교값 (문자열로 전달)"),
              })
            )
            .optional()
            .describe("필터 조건 배열"),
          order_column: z.string().optional().describe("정렬 기준 컬럼"),
          order_ascending: z.boolean().optional().describe("오름차순 여부 (기본: false)"),
          limit: z.number().optional().describe("최대 결과 수 (기본: 50)"),
        }),
        execute: async ({ table, select, filters, order_column, order_ascending, limit }) => {
          let query = db.from(table).select(select ?? "*", { count: "exact" });
          for (const f of filters ?? []) {
            if (f.operator === "in") {
              query = query.in(f.column, JSON.parse(f.value));
            } else if (f.operator === "is") {
              query = query.is(f.column, f.value === "null" ? null : f.value);
            } else {
              query = query.filter(f.column, f.operator, f.value);
            }
          }
          if (order_column) query = query.order(order_column, { ascending: order_ascending ?? false });
          query = query.limit(limit ?? 50);
          const { data, error, count } = await query;
          if (error) return { error: error.message };
          return { data, total: count };
        },
      }),

      // ── 통계/집계 쿼리 (SQL) ──
      run_sql: tool({
        description:
          "복잡한 통계, 집계, JOIN이 필요한 경우 직접 SQL을 실행합니다. SELECT 쿼리만 허용됩니다.",
        parameters: z.object({
          sql: z.string().describe("실행할 SELECT SQL 쿼리"),
        }),
        execute: async ({ sql }) => {
          // SELECT만 허용
          const normalized = sql.trim().toUpperCase();
          if (
            !normalized.startsWith("SELECT") ||
            /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b/.test(
              normalized
            )
          ) {
            return { error: "SELECT 쿼리만 허용됩니다." };
          }
          const { data, error } = await db.rpc("exec_sql", { query: sql }).single();
          // rpc 없으면 직접 실행
          if (error) {
            // Supabase JS에서 raw SQL 실행 대안
            const resp = await fetch(
              `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/`,
              {
                method: "POST",
                headers: {
                  apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
                  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                  "Content-Type": "application/json",
                },
              }
            );
            return {
              error:
                "직접 SQL 실행이 불가합니다. query_table 도구를 사용하세요.",
              hint: error.message,
            };
          }
          return { data };
        },
      }),

      // ── 레코드 수정 ──
      update_record: tool({
        description:
          "테이블의 특정 레코드를 수정합니다. 반드시 사용자에게 변경 내용을 확인받은 후 실행하세요.",
        parameters: z.object({
          table: z
            .enum(ALLOWED_TABLES as [string, ...string[]])
            .describe("수정할 테이블"),
          id: z.string().describe("수정할 레코드의 UUID"),
          updates: z
            .record(z.string(), z.unknown())
            .describe("수정할 필드와 값의 객체"),
        }),
        execute: async ({ table, id, updates }) => {
          const { data, error } = await db
            .from(table)
            .update(updates)
            .eq("id", id)
            .select()
            .single();
          if (error) return { error: error.message };
          return { success: true, data };
        },
      }),

      // ── 레코드 생성 ──
      create_record: tool({
        description:
          "테이블에 새 레코드를 생성합니다. 반드시 사용자에게 생성 내용을 확인받은 후 실행하세요.",
        parameters: z.object({
          table: z
            .enum(ALLOWED_TABLES as [string, ...string[]])
            .describe("생성할 테이블"),
          record: z
            .record(z.string(), z.unknown())
            .describe("생성할 레코드 데이터"),
        }),
        execute: async ({ table, record }) => {
          const { data, error } = await db
            .from(table)
            .insert(record)
            .select()
            .single();
          if (error) return { error: error.message };
          return { success: true, data };
        },
      }),

      // ── 레코드 삭제 ──
      delete_record: tool({
        description:
          "테이블의 특정 레코드를 삭제합니다. 반드시 사용자에게 삭제를 확인받은 후 실행하세요. 되돌릴 수 없습니다.",
        parameters: z.object({
          table: z
            .enum(ALLOWED_TABLES as [string, ...string[]])
            .describe("삭제할 테이블"),
          id: z.string().describe("삭제할 레코드의 UUID"),
        }),
        execute: async ({ table, id }) => {
          const { error } = await db.from(table).delete().eq("id", id);
          if (error) return { error: error.message };
          return { success: true };
        },
      }),

      // ── 오늘/이번달 요약 ──
      get_dashboard_summary: tool({
        description:
          "대시보드 요약 정보를 조회합니다: 이번달 상담 현황, 재원생 수, 최근 등록자, 퇴원자 등",
        parameters: z.object({}),
        execute: async () => {
          const now = new Date();
          const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
          const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

          const [consultations, students, recentRegistrations, withdrawals] =
            await Promise.all([
              db
                .from("consultations")
                .select("id, name, consult_date, status, result_status, subject", { count: "exact" })
                .gte("consult_date", monthStart)
                .lte("consult_date", monthEnd)
                .order("consult_date", { ascending: true }),
              db
                .from("students")
                .select("id", { count: "exact" })
                .eq("is_active", true),
              db
                .from("registrations")
                .select("id, name, assigned_class, created_at")
                .gte("created_at", monthStart)
                .order("created_at", { ascending: false })
                .limit(10),
              db
                .from("withdrawals")
                .select("id, name, reason_category, created_at")
                .gte("created_at", monthStart)
                .order("created_at", { ascending: false })
                .limit(10),
            ]);

          return {
            month: `${now.getFullYear()}년 ${now.getMonth() + 1}월`,
            consultations: {
              total: consultations.count ?? 0,
              data: consultations.data,
              byStatus: {
                pending: consultations.data?.filter((c) => c.status === "pending").length ?? 0,
                active: consultations.data?.filter((c) => c.status === "active").length ?? 0,
                completed: consultations.data?.filter((c) => c.status === "completed").length ?? 0,
              },
              byResult: {
                registered: consultations.data?.filter((c) => c.result_status === "registered").length ?? 0,
                hold: consultations.data?.filter((c) => c.result_status === "hold").length ?? 0,
                none: consultations.data?.filter((c) => c.result_status === "none").length ?? 0,
              },
            },
            activeStudents: students.count ?? 0,
            recentRegistrations: recentRegistrations.data,
            recentWithdrawals: withdrawals.data,
          };
        },
      }),
    },
    maxSteps: 10,
  });

  return result.toDataStreamResponse();
}
