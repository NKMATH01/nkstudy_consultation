import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { env } from "@/lib/env";
import {
  createProposal,
  ENTITY_LABELS,
  OPERATION_LABELS,
} from "@/lib/chat-tools";
import {
  getSurveyV2Subject,
  getV2CoreMetrics,
  SUBJECT_LABEL_V2,
} from "@/lib/assessment/v2/display";
import { statusOf } from "@/lib/withdrawal-status";
import { WITHDRAWAL_STATUS_LABELS } from "@/types";

const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

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
function getMessageText(msg: { parts?: { type: string; text?: string }[]; content?: string }) {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p: { type: string }) => p.type === "text")
      .map((p: { text?: string }) => p.text || "")
      .join("");
  }
  return "";
}

function mapConsultationForPrompt(c: Record<string, unknown>) {
  return {
    이름: c.name,
    날짜: c.consult_date,
    과목: c.subject,
    상태: c.status,
    결과: c.result_status,
    학교: c.school,
    학년: c.grade,
    메모: c.memo,
    상담기록지: {
      기존학원: c.prev_academy,
      기존학원불만: c.prev_complaint,
      학교성적: c.school_score,
      테스트점수: c.test_score,
      선행수준: c.advance_level,
      학습목표: c.study_goal,
      희망요일: c.prefer_days,
      등록예정일: c.plan_date,
      등록예정반: c.plan_class,
    },
    상세메모: {
      요청사항: c.requests,
      학생상담메모: c.student_consult_note,
      학부모상담메모: c.parent_consult_note,
    },
  };
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mapSurveyForPrompt(s: Record<string, unknown>) {
  if (s.instrument_version !== "v2") {
    return {
      버전: "V1 과거 설문",
      이름: s.name,
      학교: s.school,
      학년: s.grade,
      수업태도: s.factor_attitude,
      자기주도: s.factor_self_directed,
      과제수행: s.factor_assignment,
      학업의지: s.factor_willingness,
      사회성: s.factor_social,
      관리선호: s.factor_management,
      심리자신감: s.factor_emotion,
      날짜: stringValue(s.created_at)?.split("T")[0],
    };
  }

  const intake = recordValue(s.intake_v2);
  const profile = recordValue(s.score_profile_v2);
  const nkFit = recordValue(profile.nkFit);
  const quality = recordValue(profile.responseQuality);
  const subject = getSurveyV2Subject(s);
  const metrics = Object.fromEntries(
    getV2CoreMetrics(profile).map((metric) => [metric.label, metric.score])
  );
  return {
    버전: "V2 학습 프로필",
    이름: s.name,
    학교: s.school,
    학년: s.grade,
    진단과목: SUBJECT_LABEL_V2[subject],
    학습이력: {
      기존학원: intake.prev_academy,
      재원기간: intake.prev_academy_duration,
      이동이유: intake.prev_leave_reason,
      아쉬운점: intake.prev_complaint,
      유입경로: intake.referral,
      NK인지: intake.nk_knowledge,
    },
    기대일정: {
      NK기대: intake.nk_expectations,
      희망요일: intake.preferred_days,
      등원시간: intake.available_time,
      주중자습: intake.weekday_selfstudy,
      클리닉조건: intake.clinic_condition,
      통학수단: intake.commute_method,
      통원시간: intake.commute_time,
    },
    자기인식: {
      미래계획: intake.has_future_plan,
      장래희망: intake.dream,
      목표대학계열: intake.target_university,
      공부핵심: intake.study_core,
      스스로느끼는문제: intake.problem_self,
      수학어려움: intake.math_difficulty,
      영어어려움: intake.english_difficulty,
      요청사항: intake.requests,
      첫14일약속: intake.commitment14,
    },
    핵심점수_0_100: metrics,
    NK운영적합: { 단계: nkFit.stage, 점수: nkFit.overall },
    응답품질: quality.status,
    날짜: stringValue(s.created_at)?.split("T")[0],
  };
}

function mapAnalysisForPrompt(a: Record<string, unknown>) {
  if (a.analysis_version !== "v2") {
    return {
      버전: "V1 과거 분석",
      이름: a.name,
      유형: a.student_type,
      요약: stringValue(a.summary)?.slice(0, 100),
      수업태도: a.score_attitude,
      자기주도: a.score_self_directed,
      과제수행: a.score_assignment,
      학업의지: a.score_willingness,
      사회성: a.score_social,
      관리선호: a.score_management,
      날짜: stringValue(a.created_at)?.split("T")[0],
    };
  }

  const result = recordValue(a.result_profile_v2);
  const scores = recordValue(result.scores);
  const coaching = recordValue(scores.coaching);
  const nkFit = recordValue(scores.nkFit);
  const quality = recordValue(scores.responseQuality);
  return {
    버전: "V2 학습 프로필 분석",
    이름: a.name,
    유형: a.student_type,
    요약: stringValue(a.summary)?.slice(0, 300),
    진단과목: result.subjectSelection,
    핵심점수_0_100: Object.fromEntries(
      getV2CoreMetrics(scores).map((metric) => [metric.label, metric.score])
    ),
    지도유형: coaching.coachingType,
    자율구조유형: coaching.autonomyStructureType,
    NK운영적합: { 단계: nkFit.stage, 점수: nkFit.overall },
    응답품질: quality.status,
    날짜: stringValue(a.created_at)?.split("T")[0],
  };
}

const CONSULTATION_RECORD_FIELDS = new Set([
  "prev_academy",
  "prev_complaint",
  "school_score",
  "test_score",
  "advance_level",
  "study_goal",
  "prefer_days",
  "plan_date",
  "plan_class",
]);

const CONSULTATION_DETAIL_FIELDS = new Set([
  "requests",
  "student_consult_note",
  "parent_consult_note",
]);

function validateConsultationSectionMutation(
  userText: string,
  entity: string,
  operation: string,
  changes: Record<string, unknown>
) {
  if (entity !== "consultation" || operation !== "update") return;

  const normalized = userText.replace(/\s+/g, " ");
  const wantsRecord = /상담\s*기록지|기록지/.test(normalized);
  const wantsDetail = /상세\s*메모|학생\s*상담\s*메모|학부모\s*상담\s*메모/.test(normalized);
  const wantsStructured = wantsRecord || wantsDetail || /각\s*항목/.test(normalized);

  if (!wantsStructured) return;

  const keys = Object.keys(changes);
  const usesPlainMemo = keys.includes("memo");
  const hasRecordField = keys.some((key) => CONSULTATION_RECORD_FIELDS.has(key));
  const hasDetailField = keys.some((key) => CONSULTATION_DETAIL_FIELDS.has(key));

  if (usesPlainMemo) {
    throw new Error("상담 기록지/상세 메모 요청은 memo가 아니라 상담 기록지 필드와 상세 메모 필드에 저장해야 합니다.");
  }
  if (!hasRecordField && !hasDetailField) {
    throw new Error("상담 기록지/상세 메모 요청인데 구조화된 consultation 필드가 없습니다.");
  }
  if (wantsRecord && !hasRecordField) {
    throw new Error("상담 기록지 요청인데 상담 기록지 필드(prev_academy, test_score, advance_level, prefer_days, plan_date, plan_class 등)가 없습니다.");
  }
  if (wantsDetail && !hasDetailField) {
    throw new Error("상세 메모 요청인데 상세 메모 필드(requests, student_consult_note, parent_consult_note)가 없습니다.");
  }
}

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
    db.from("surveys").select("id, name, school, grade, instrument_version, subject_selection, intake_v2, score_profile_v2, factor_attitude, factor_self_directed, factor_assignment, factor_willingness, factor_social, factor_management, factor_emotion, created_at").order("created_at", { ascending: false }).limit(50),
    db.from("analyses").select("id, survey_id, name, analysis_version, result_profile_v2, student_type, summary, score_attitude, score_self_directed, score_assignment, score_willingness, score_social, score_management, created_at").order("created_at", { ascending: false }).limit(30),
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
${JSON.stringify(thisMonthConsults.map(c => mapConsultationForPrompt(c)), null, 0)}

### 전체 상담 최근 100건
${JSON.stringify((consultations.data || []).map(c => mapConsultationForPrompt(c)), null, 0)}

### 설문 최근 50건
${JSON.stringify((surveys.data || []).map(s => mapSurveyForPrompt(s as Record<string, unknown>)), null, 0)}

### AI 성향분석 최근 30건
${JSON.stringify((analyses.data || []).map(a => mapAnalysisForPrompt(a as Record<string, unknown>)), null, 0)}

### 등록안내 최근 30건
${JSON.stringify((registrations.data || []).map(r => ({ 이름: r.name, 배정반: r.assigned_class, 담임: r.teacher, 과목: r.subject, 수강료: r.tuition_fee, 날짜: r.created_at?.split("T")[0] })), null, 0)}

### 이번달 예약
${JSON.stringify((bookings.data || []).map(b => ({ 학생: b.student_name, 날짜: b.booking_date, 시간: b.booking_hour, 지점: b.branch, 유형: b.consult_type, 결제: b.paid })), null, 0)}

### 퇴원생 최근 30건
${JSON.stringify((withdrawals.data || []).map(w => ({ 이름: w.name, 과목: w.subject, 반: w.class_name, 담임: w.teacher, 사유: w.reason_category, 복귀가능: w.comeback_possibility, 퇴원일: w.withdrawal_date, 상태: WITHDRAWAL_STATUS_LABELS[statusOf(w)] })), null, 0)}
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
    const lastUserText = [...messages]
      .reverse()
      .find((msg: { role: string }) => msg.role === "user");
    const latestUserMessage = lastUserText ? getMessageText(lastUserText) : "";

    // DB 데이터 조회
    const dataContext = await buildDataContext();

    const systemPrompt = `당신은 NK EDUCATION 학원의 상담관리 시스템 AI 어시스턴트입니다.
데이터를 조회하고, 사용자가 요청하면 데이터를 입력/수정/삭제할 수 있습니다.

## 절대 규칙 — 할루시네이션 방지 (위반 시 심각한 문제 발생)

1. **오직 아래 [실시간 데이터] 섹션에 있는 정보만 사용하세요.**
2. **데이터에 없는 내용은 절대 만들어내지 마세요.** "해당 데이터가 없습니다"라고 답하세요.
3. **학생 이름, 전화번호, 점수, 날짜 등 구체적인 값은 반드시 데이터에서 그대로 인용하세요.** 절대 추측하거나 비슷한 값을 만들지 마세요.
4. **숫자를 말할 때는 데이터를 직접 세어서 답하세요.** 대략적인 수치를 말하지 마세요.
5. **모르면 모른다고 하세요.** 추측보다 "데이터에서 확인할 수 없습니다"가 100배 낫습니다.
6. **한국어로 답변하세요.**
7. **표가 적절하면 마크다운 표를 사용하세요.**

## 데이터 수정 기능 — 매우 중요

**당신은 데이터를 수정할 수 있습니다. 수정/삭제 요청을 절대 거부하지 마세요.**
수정 방법: 응답 텍스트에 아래 형식의 MUTATION 마커를 반드시 포함하세요. 마커를 포함하면 시스템이 자동으로 사용자에게 확인 카드를 보여줍니다.

형식: <!--MUTATION:{"entity":"엔티티","operation":"작업","targetName":"이름","changes":{"필드":"값"},"reason":"사유"}-->

### 수정 요청 응답 예시 (반드시 이 패턴을 따르세요):
사용자: "강해린 고민중으로 바꿔줘"
응답: "강해린 학생의 상담 결과를 고민중으로 변경하겠습니다.
<!--MUTATION:{"entity":"consultation","operation":"update","targetName":"강해린","changes":{"result_status":"hold"},"reason":"상담 결과 고민중으로 변경"}-->
위 내용을 확인해주세요. 확인 버튼을 누르면 실행됩니다."

### 수정 시 안전 규칙:
8. **대상은 반드시 [실시간 데이터]에서 이름이 정확히 일치하는 레코드여야 합니다.**
9. **데이터에 없는 사람은 수정/삭제하지 마세요.** "해당 데이터를 찾을 수 없습니다"라고 답하세요.
10. **동명이인이 있으면 사용자에게 어떤 레코드인지 확인하세요.**
11. **삭제 시 해당 레코드 정보를 보여주고 확인을 요청하세요.**
12. **없는 필드에 값을 넣지 마세요.**
13. **하나의 요청에 하나의 MUTATION 마커만 포함하세요.**
14. **MUTATION 마커 뒤에 "확인 버튼을 누르면 실행됩니다" 안내를 추가하세요.**
15. **"변경했습니다" 등 완료된 것처럼 말하지 마세요.** 사용자가 확인해야 실행됩니다.

## 시스템 개요
NK EDUCATION은 수학/영어 학원입니다.
- 상담 상태: pending(대기) → active(진행중) → completed(완료) / cancelled(취소)
- 상담 결과: none(미결정) → registered(등록) / hold(고민중) / other(미등록)
- 상담 결과 한국어 매핑: "등록"→registered, "고민"/"고민중"→hold, "미등록"→other, "미결정"/"미정"→none
- 설문/분석은 버전 구분이 필수입니다. V1 과거 자료만 7-Factor(1~5점)를 사용합니다.
- V2 최신 학습 프로필은 0~100 서버 점수(학습 태도, 숙제 신뢰도, 장기 의지, 단기 회복력, 휴대폰 자기조절, 학습 성실성), 지도 유형, NK 운영 적합 단계, 첫 14일 확인 계획을 사용합니다. V2를 V1 지표로 바꾸거나 빈 V1 점수를 해석하지 마세요.

## 데이터 한계
- 재원생: 전체 (is_active=true)
- 강사: 전체 (is_active=true)
- 반: 전체 (is_active=true)
- 상담: 최근 100건
- 설문: 최근 50건
- 분석/등록/퇴원생: 최근 30건
- 예약: 이번달
- 이 범위를 벗어나는 질문에는 "조회 범위(최근 N건)를 초과합니다"라고 답하세요.

오늘 날짜: ${new Date().toISOString().split("T")[0]}

### 지원 엔티티 및 작업:
- consultation (상담): 등록/수정/삭제 가능 — 필수: name
- student (학생): 등록/수정 가능 (삭제 불가) — 필수: name
- booking (예약): 수정/삭제 가능 (등록 불가)
- withdrawal (퇴원생): 등록/수정/삭제 가능 — 필수: name
- teacher (강사): 등록/수정/삭제 가능 — 필수: name
- class (반): 등록/수정/삭제 가능 — 필수: name

### changes 필드 작성 가이드 (이 목록에 없는 필드는 사용하지 마세요):
- consultation: name, school, grade, parent_phone, consult_date(YYYY-MM-DD), consult_time(HH:MM), subject, location, consult_type, memo, status(pending/active/completed/cancelled), result_status(none=미결정/registered=등록/hold=고민중/other=미등록), prev_academy, prev_complaint, school_score, test_score, advance_level, study_goal, prefer_days, plan_date(YYYY-MM-DD), plan_class, requests, student_consult_note, parent_consult_note, parent_consult_date(YYYY-MM-DD), parent_consult_time(HH:MM), parent_location, test_fee_paid(true/false), test_fee_method(transfer=입금/card=카드/exempt=면제)
- student: name, school, grade, phone, parent_phone, class_name, teacher_name, subject, memo
- booking: student_name, phone, booking_date(YYYY-MM-DD), booking_hour(정수 13~20), branch, consult_type, paid(true/false), memo
- withdrawal: name, school, subject, class_name, teacher, grade, reason_category, withdrawal_date(YYYY-MM-DD)
- teacher: name, phone, subject(과목), is_active(true/false) — role(역할)은 AI로 변경 불가, 설정 페이지에서만 가능
- class: name, target_grade, class_days(수업요일), class_time, clinic_time, weekly_test_time, location, is_active(true/false)

### consultation 필드 사용 규칙:
- 사용자가 "상담 기록지", "상세 메모", "각 항목에 적용", "기록지에 써줘"라고 말하면 memo 하나에 몰아넣지 말고 구조화된 consultation 필드에 나눠서 넣으세요.
- memo는 짧은 일반 메모에만 사용하세요. 상담 기록지 내용은 prev_academy, prev_complaint, school_score, test_score, advance_level, study_goal, prefer_days, plan_date, plan_class, requests, student_consult_note, parent_consult_note 같은 구조화 필드에 우선 배치하세요.
- 하나의 요청 안에서 consultation의 여러 필드를 동시에 수정해야 하면 하나의 MUTATION 마커 안의 changes 객체에 여러 필드를 함께 넣으세요.
- 날짜가 "4월말~5월초"처럼 애매하면 plan_date에 임의 날짜를 넣지 말고 requests 또는 parent_consult_note에 그대로 기록하세요.
- 진도/선행 정보는 advance_level, 테스트 결과는 test_score, 희망 요일은 prefer_days, 학부모 요구사항은 requests 또는 parent_consult_note, 학생 상태 설명은 student_consult_note에 우선 매핑하세요.
- 예시: "강해린 상담 기록지에 반영해줘"라면 test_score, advance_level, prefer_days, requests, student_consult_note, parent_consult_note를 함께 업데이트하는 방향으로 작성하세요.
- 사용자가 "상담 기록지와 상세 메모에 작성"이라고 말하면 changes 안에 상담 기록지 필드와 상세 메모 필드를 둘 다 넣으세요. 둘 중 하나만 넣으면 안 됩니다.
- 상담 기록지/상세 메모 요청에서 memo 필드는 사용하지 마세요. memo를 쓰면 잘못된 위치에 저장됩니다.
- 강해린 예시 매핑: advance_level="미적분까지 진행", test_score="공수1,2 10점 / 중3 테스트 70점", prefer_days="월수", requests="진도에 민감한 학부모 성향. 현재 수준 대비 진도 괴리 안내 필요", student_consult_note="중2 때부터 사춘기로 실력이 많이 떨어진 상태", parent_consult_note="중간고사 이후 4월말~5월초 등록 희망"

${dataContext}`;

    // UIMessage[] → ModelMessage[] 변환 (useChat v3 호환)
    const modelMessages = messages.map((msg: { role: string; parts?: { type: string; text?: string }[]; content?: string }) => ({
      role: msg.role,
      content: getMessageText(msg),
    }));

    const result = streamText({
      model: anthropic("claude-sonnet-4-6"),
      system: systemPrompt,
      messages: modelMessages,
      maxOutputTokens: 4096,
    });

    // 전체 텍스트 수집
    const finalText = await result.text;

    // AI가 <!--MUTATION:JSON--> 마커를 출력했으면 서버에서 proposal 생성
    const mutationRegex = /<!--MUTATION:(.*?)-->/g;
    let responseText = finalText;
    let match;
    while ((match = mutationRegex.exec(finalText)) !== null) {
      try {
        const mutation = JSON.parse(match[1]);
        const { entity, operation, targetName, targetId, changes, reason } = mutation;
        const parsedChanges = typeof changes === "string" ? JSON.parse(changes) : (changes || {});
        validateConsultationSectionMutation(latestUserMessage, entity, operation, parsedChanges);
        const { proposal, summary } = await createProposal({
          entity, operation, targetName, targetId,
          changes: parsedChanges,
          reason: reason || "AI 제안",
        });
        const toolResult = {
          status: "pending_confirmation",
          proposal, summary,
          entityLabel: ENTITY_LABELS[entity] || entity,
          operationLabel: OPERATION_LABELS[operation] || operation,
        };
        responseText = responseText.replace(match[0], `<!--TOOL_RESULT:${JSON.stringify(toolResult)}-->`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "제안 생성 실패";
        const toolResult = { status: "error", message: errMsg };
        responseText = responseText.replace(match[0], `<!--TOOL_RESULT:${JSON.stringify(toolResult)}-->`);
      }
    }

    return new Response(responseText || "응답을 생성하지 못했습니다.", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[chat API error]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
