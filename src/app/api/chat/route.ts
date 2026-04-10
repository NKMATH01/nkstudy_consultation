// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "@/lib/env";

const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });

async function getCallerRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  if (user.email === "admin@nk.com") {
    return { name: "관리자", role: "admin" };
  }

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

  return null;
}

function getAdminSupabase() {
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// 모든 핵심 데이터를 미리 조회해서 system prompt에 삽입
async function buildDataContext() {
  const db = getAdminSupabase();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

  const [students, teachers, classes, consultations, surveys, analyses, registrations, bookings, withdrawals] = await Promise.all([
    db.from("students").select("*").eq("is_active", true).order("class_name").order("name"),
    db.from("teachers").select("*").eq("is_active", true).order("name"),
    db.from("classes").select("*").eq("is_active", true).order("name"),
    db.from("consultations").select("*").order("consult_date", { ascending: false }).limit(100),
    db.from("surveys").select("id, name, school, grade, factor_attitude, factor_self_directed, factor_assignment, factor_willingness, factor_social, factor_management, factor_emotion, created_at").order("created_at", { ascending: false }).limit(50),
    db.from("analyses").select("id, survey_id, name, student_type, summary, score_attitude, score_self_directed, score_assignment, score_willingness, score_social, score_management, created_at").order("created_at", { ascending: false }).limit(30),
    db.from("registrations").select("id, name, assigned_class, teacher, subject, tuition_fee, created_at").order("created_at", { ascending: false }).limit(30),
    db.from("bookings").select("*").gte("booking_date", monthStart).order("booking_date"),
    db.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(30),
  ]);

  const thisMonthConsults = (consultations.data || []).filter(c => c.consult_date >= monthStart && c.consult_date <= monthEnd);

  return `
## 실시간 데이터 (${today} 기준)

### 재원생 (${students.data?.length || 0}명)
${JSON.stringify((students.data || []).map(s => ({ 이름: s.name, 반: s.class_name, 학교: s.school, 학년: s.grade, 전화: s.phone, 학부모전화: s.parent_phone, 담임: s.teacher_name, 메모: s.memo })), null, 0)}

### 강사 (${teachers.data?.length || 0}명)
${JSON.stringify((teachers.data || []).map(t => ({ 이름: t.name, 역할: t.role, 과목: t.building, 전화: t.phone })), null, 0)}

### 반 (${classes.data?.length || 0}개)
${JSON.stringify((classes.data || []).map(c => ({ 이름: c.name, 요일: c.description, 수업시간: c.class_time, 클리닉시간: c.clinic_time, 대상학년: c.target_grade })), null, 0)}

### 이번달 상담 (${thisMonthConsults.length}건)
${JSON.stringify(thisMonthConsults.map(c => ({ 이름: c.name, 날짜: c.consult_date, 과목: c.subject, 상태: c.status, 결과: c.result_status, 학교: c.school, 학년: c.grade, 메모: c.memo })), null, 0)}

### 전체 상담 최근 100건
${JSON.stringify((consultations.data || []).map(c => ({ 이름: c.name, 날짜: c.consult_date, 과목: c.subject, 상태: c.status, 결과: c.result_status, 학교: c.school, 학년: c.grade })), null, 0)}

### 설문 최근 50건
${JSON.stringify((surveys.data || []).map(s => ({ 이름: s.name, 학교: s.school, 학년: s.grade, 수업태도: s.factor_attitude, 자기주도: s.factor_self_directed, 과제수행: s.factor_assignment, 학업의지: s.factor_willingness, 사회성: s.factor_social, 관리선호: s.factor_management, 심리자신감: s.factor_emotion, 날짜: s.created_at?.split("T")[0] })), null, 0)}

### AI 성향분석 최근 30건
${JSON.stringify((analyses.data || []).map(a => ({ 이름: a.name, 유형: a.student_type, 요약: a.summary?.slice(0, 100), 수업태도: a.score_attitude, 자기주도: a.score_self_directed, 과제수행: a.score_assignment, 학업의지: a.score_willingness, 사회성: a.score_social, 관리선호: a.score_management, 날짜: a.created_at?.split("T")[0] })), null, 0)}

### 등록안내 최근 30건
${JSON.stringify((registrations.data || []).map(r => ({ 이름: r.name, 배정반: r.assigned_class, 담임: r.teacher, 과목: r.subject, 수강료: r.tuition_fee, 날짜: r.created_at?.split("T")[0] })), null, 0)}

### 이번달 예약
${JSON.stringify((bookings.data || []).map(b => ({ 학생: b.student_name, 날짜: b.booking_date, 시간: b.booking_hour, 지점: b.branch, 유형: b.consult_type, 결제: b.paid })), null, 0)}

### 퇴원생 최근 30건
${JSON.stringify((withdrawals.data || []).map(w => ({ 이름: w.name, 과목: w.subject, 반: w.class_name, 담임: w.teacher, 사유: w.reason_category, 복귀가능: w.comeback_possibility, 퇴원일: w.enrollment_end })), null, 0)}
`;
}

export async function POST(req: Request) {
  try {
    const caller = await getCallerRole();
    if (!caller) return new Response("Unauthorized", { status: 401 });
    if (!["director", "principal", "admin"].includes(caller.role ?? "")) {
      return new Response("Forbidden", { status: 403 });
    }

    const { messages } = await req.json();

    // DB 데이터 조회
    const dataContext = await buildDataContext();

    const systemPrompt = `당신은 NK EDUCATION 학원의 상담관리 시스템 데이터 조회 전용 AI입니다.

## 절대 규칙 (위반 시 심각한 문제 발생)

1. **오직 아래 [실시간 데이터] 섹션에 있는 정보만 사용하세요.**
2. **데이터에 없는 내용은 절대 만들어내지 마세요.** "해당 데이터가 없습니다" 또는 "조회 범위에 포함되지 않습니다"라고 답하세요.
3. **학생 이름, 전화번호, 점수, 날짜 등 구체적인 값은 반드시 데이터에서 그대로 인용하세요.** 절대 추측하거나 비슷한 값을 만들지 마세요.
4. **숫자를 말할 때는 데이터를 직접 세어서 답하세요.** 대략적인 수치를 말하지 마세요.
5. **모르면 모른다고 하세요.** 추측보다 "데이터에서 확인할 수 없습니다"가 100배 낫습니다.
6. **한국어로 답변하세요.**
7. **표가 적절하면 마크다운 표를 사용하세요.**

## 시스템 개요
NK EDUCATION은 수학/영어 학원입니다.
- 상담 상태: pending(대기) → active(진행중) → completed(완료) / cancelled(취소)
- 상담 결과: none(미결정) → registered(등록) / hold(보류) / other(기타)
- 설문 7-Factor (1~5점): 수업태도, 자기주도성, 과제수행력, 학업의지, 사회성, 관리선호, 심리·자신감

## 데이터 한계
- 재원생: 전체 (is_active=true)
- 상담: 최근 100건
- 설문: 최근 50건
- 분석/등록/퇴원생: 최근 30건
- 예약: 이번달
- 이 범위를 벗어나는 질문에는 "조회 범위(최근 N건)를 초과합니다"라고 답하세요.

오늘 날짜: ${new Date().toISOString().split("T")[0]}

${dataContext}`;

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages,
      maxOutputTokens: 4096,
    });

    return result.toTextStreamResponse();
  } catch (err) {
    console.error("[chat API error]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
