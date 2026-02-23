import type { Analysis, Survey } from "@/types";
import { SURVEY_QUESTIONS, FACTOR_LABELS } from "@/types";
import { env } from "@/lib/env";

function getClaudeApiKey() {
  return env.ANTHROPIC_API_KEY;
}

// ========== Claude API 호출 ==========
export async function callClaudeAPI(prompt: string, retryCount = 0): Promise<string> {
  const maxRetries = 3;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60초 타임아웃

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getClaudeApiKey(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.CLAUDE_MODEL,
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if ((res.status === 429 || res.status >= 500) && retryCount < maxRetries) {
    const delay = res.status === 529 ? 5000 * (retryCount + 1) : 2000 * (retryCount + 1);
    await new Promise((r) => setTimeout(r, delay));
    return callClaudeAPI(prompt, retryCount + 1);
  }

  if (!res.ok) {
    const text = await res.text();
    console.error("[Claude API] 호출 실패:", { status: res.status, body: text.substring(0, 200) });
    throw new Error(`Claude API 오류: ${res.status} - ${text.substring(0, 200)}`);
  }

  const result = await res.json();

  if (result.content?.[0]?.text) {
    return result.content[0].text;
  }

  if (result.stop_reason === "end_turn") {
    return result.content?.map((c: { text?: string }) => c.text || "").join("") || "";
  }

  throw new Error("Claude 응답 형식 오류");
}

// ========== 설문 데이터 → 텍스트 변환 ==========
export function surveyToText(survey: Survey): string {
  let text = "";

  text += `학생 이름: ${survey.name}\n`;
  text += `학교/학년: ${survey.school || ""} ${survey.grade || ""}\n`;
  text += `학생 연락처: ${survey.student_phone || ""}\n`;
  text += `학부모 연락처: ${survey.parent_phone || ""}\n`;
  text += `유입 경로: ${survey.referral || ""}\n`;
  text += `기존 학원: ${survey.prev_academy || ""}\n`;
  text += `기존 학원 아쉬운점: ${survey.prev_complaint || ""}\n\n`;

  text += "=== 설문 응답 (1-5점) ===\n";
  for (let i = 0; i < SURVEY_QUESTIONS.length; i++) {
    const qNum = i + 1;
    const score = survey[`q${qNum}` as keyof Survey] as number | null;
    text += `${qNum}. ${SURVEY_QUESTIONS[i]}: ${score ?? "미응답"}\n`;
  }

  text += "\n=== 7-Factor 평균 점수 ===\n";
  const factorKeys = ["attitude", "self_directed", "assignment", "willingness", "social", "management", "emotion"] as const;
  for (const key of factorKeys) {
    const val = survey[`factor_${key}` as keyof Survey] as number | null;
    text += `${FACTOR_LABELS[key]}: ${val?.toFixed(1) ?? "N/A"}\n`;
  }

  text += `\n=== 주관식 ===\n`;
  text += `공부의 핵심: ${survey.study_core || ""}\n`;
  text += `본인의 학습 문제점: ${survey.problem_self || ""}\n`;
  text += `희망 직업: ${survey.dream || ""}\n`;
  text += `선호 요일: ${survey.prefer_days || ""}\n`;
  text += `NK학원에 바라는 점: ${survey.requests || ""}\n`;
  text += `수학 어려운 영역: ${survey.math_difficulty || ""}\n`;
  text += `영어 어려운 영역: ${survey.english_difficulty || ""}\n`;

  return text;
}

// ========== 등록 보고서 관리 데이터 인터페이스 ==========
export interface RegistrationAdminData {
  registrationDate: string;
  assignedClass: string;
  teacher: string;
  assignedClass2?: string;
  teacher2?: string;
  subject: string;
  preferredDays: string;
  useVehicle: string;
  testScore: string;
  testNote: string;
  location: string;
  consultDate: string;
  additionalNote: string;
  tuitionFee: number;
}

// ========== 등록 보고서 프롬프트 ==========
export function buildRegistrationPrompt(
  surveyText: string,
  analysis: Analysis,
  adminData: RegistrationAdminData
): string {
  const vehicleFeeRaw = env.NK_ACADEMY_VEHICLE_FEE || "20000";
  const vehicleFeeVal = vehicleFeeRaw.includes("만")
    ? parseInt(vehicleFeeRaw.replace(/[^0-9]/g, "")) * 10000 || 20000
    : parseInt(vehicleFeeRaw.replace(/[^0-9]/g, "")) || 20000;
  const vehicleFee = vehicleFeeVal >= 10000 ? `${vehicleFeeVal / 10000}만원` : `${vehicleFeeVal.toLocaleString()}원`;
  const bankInfo = env.NK_ACADEMY_BANK_INFO || "신한은행 110-383-883419";
  const bankOwner = env.NK_ACADEMY_BANK_OWNER || "노윤희";

  const classInfo = adminData.subject === "영어수학"
    ? `수학반: ${adminData.assignedClass} (${adminData.teacher} 선생님) / 영어반: ${adminData.assignedClass2 || ""} (${adminData.teacher2 || ""} 선생님)`
    : `${adminData.assignedClass} (${adminData.teacher} 선생님)`;

  return `# Role

당신은 'NK EDUCATION'의 입시 분석 전문가이자 수석 행정 관리자입니다.

당신의 목표는 학생의 설문조사 데이터를 분석하고, 행정 정보를 결합하여, 신입생 등록 및 분석 보고서의 내용을 JSON 형식으로 생성하는 것입니다.

# Analysis Logic (분석 로직)

1. **성향 점수(1~5)**: 문항 번호 뒤의 숫자를 파악하여 5점 만점 환산.
    - 1~5번(성격): 점수가 높으면 적극적/사회적, 낮으면 차분함.
    - 6~10번(태도): 점수가 높으면 성실/집중, 낮으면 관리 필요.
    - 18~19번(탐구력): 점수가 높으면 '집요한 탐구력' 강조 (NK 인재상).

2. **강점 및 가이드 작성**:
    - 학생이 '이해'를 중시하면 "Why 중심의 설명" 가이드 작성.
    - 학생이 '친구'를 중시하면 "면학 분위기 관리" 및 "선의의 경쟁" 키워드 사용.
    - 필기 점수(7번 등)가 낮으면 "노트 필기 강화" 조치사항 포함.

# NK EDUCATION 학원 정보 (고정값)

1. **수업료**:
   - 초4~5: 30만원 / 초6~중1: 32만원 / 중2~3: 35만원 / 고1: 38만원 / 고2: 40만원
   - (반드시 "교재비 별도" 표기)
2. **차량비**: 월 ${vehicleFee}
3. **계좌 정보**: ${bankInfo} (예금주: ${bankOwner})
4. **환불 규정**: 교육청 교습비 반환 기준 준수 / 2주 이상 미납 시 수업 제한.

[수업 장소]
1: 자이센터 8층 / 2: 폴리타운B동 4층 / 3: 폴리타운A동 7층

[학생 설문 데이터]
${surveyText}

[AI 분석 결과]
학생유형: ${analysis.student_type}
수업태도: ${analysis.score_attitude}점
자기주도성: ${analysis.score_self_directed}점
과제수행력: ${analysis.score_assignment}점
학업의지: ${analysis.score_willingness}점
사회성: ${analysis.score_social}점
관리선호도: ${analysis.score_management}점
심리·자신감: ${analysis.score_emotion ?? "N/A"}점
종합요약: ${analysis.summary}
강점: ${(analysis.strengths || []).map(s => s.title).join(", ") || "없음"}
개선영역: ${(analysis.weaknesses || []).map(w => w.title).join(", ") || "없음"}
학생유형설명: ${analysis.final_assessment || "없음"}

[행정 정보]
- 등록일: ${adminData.registrationDate}
- 과목: ${adminData.subject}
- 배정: ${classInfo}
- 희망요일: ${adminData.preferredDays}
- 차량 이용: ${adminData.useVehicle || "미사용"}
- 테스트 점수: ${adminData.testScore || "미입력"}
- 테스트 특이사항: ${adminData.testNote || "없음"}
- 수업 장소: ${adminData.location || "미정"}
- 학부모 상담 예정일: ${adminData.consultDate || "미정"}
- 추가 조치사항: ${adminData.additionalNote || "없음"}
- 수업료: ${adminData.tuitionFee.toLocaleString()}원

[출력 형식 - 반드시 아래 JSON 구조로만 반환하세요. JSON 외 다른 텍스트는 출력하지 마세요]
{
  "page1": {
    "docNo": "문서 번호 (YYYYMMDD-이니셜, 예: 20250106-CHB)",
    "deptLabel": "과목 부서명 (예: Math Dept / English Dept / Math & English Dept)",
    "profileSummary": "진단 결과 요약 (테스트 점수 + 성향분석 기반, 학생 핵심 특성 1~2문장)",
    "studentBackground": "학생 배경 분석 (기존 학원 경험, 아쉬웠던 점, NK 유입 경로 기반으로 학생이 NK학원에서 기대하는 것과 보완해야 할 점 요약, 2~3문장)",
    "sixFactorScores": [
      {"factor": "수업태도", "score": 4.0, "grade": "우수/양호/보통/주의 중 하나", "insight": "핵심 인사이트 1문장"},
      {"factor": "자기주도성", "score": 3.5, "grade": "...", "insight": "..."},
      {"factor": "과제수행력", "score": 4.0, "grade": "...", "insight": "..."},
      {"factor": "학업의지", "score": 3.0, "grade": "...", "insight": "..."},
      {"factor": "사회성", "score": 3.5, "grade": "...", "insight": "..."},
      {"factor": "관리선호도", "score": 4.0, "grade": "...", "insight": "..."},
      {"factor": "심리·자신감", "score": 3.5, "grade": "...", "insight": "... (심리·자신감 점수가 N/A이면 이 항목 생략)"}
    ],
    "managementGuide": [
      {"title": "가이드 제목 1", "description": "상세 설명 (2문장, 담임이 실행할 구체적 행동)"},
      {"title": "가이드 제목 2", "description": "상세 설명 (2문장)"},
      {"title": "가이드 제목 3", "description": "상세 설명 (2문장)"},
      {"title": "가이드 제목 4", "description": "상세 설명 (2문장)"}
    ],
    "actionChecklist": [
      "학생 성향에 맞는 담임 준비사항 1 (순수 텍스트만, 기호 절대 넣지 말 것)",
      "학생 성향에 맞는 담임 준비사항 2 (예: 자기주도성이 낮으면 '첫 주 숙제 점검 강화', 수업태도가 좋으면 '심화 문제 별도 준비' 등)"
    ]
  },
  "page2": {
    "welcomeTitle": "환영 문구 제목 (예: 논리적 사고를 통한 <strong>수학적 도약</strong>의 시작)",
    "welcomeSubtitle": "환영 부제 (예: NK 교육 입학을 진심으로 축하드립니다.)",
    "expertDiagnosis": "전문가 진단 종합 의견 (3~4문장, 학생 특성 + 학습 전략 포함, 120자 내외)",
    "focusPoints": [
      {"number": "01", "title": "포인트 제목", "description": "상세 설명 (2~3문장, 80자 내외)"},
      {"number": "02", "title": "포인트 제목", "description": "상세 설명 (2~3문장, 80자 내외)"},
      {"number": "03", "title": "포인트 제목", "description": "상세 설명 (2~3문장, 80자 내외)"},
      {"number": "04", "title": "포인트 제목", "description": "상세 설명 (2~3문장, 80자 내외)"}
    ],
    "parentMessage": "학부모님께 드리는 당부 (3~4문장, 가정 학습 지원 + 학원 소통 안내, 120자 내외)",
    "academyRules": [
      "출결/지각 관련 규칙 (1문장)",
      "숙제/과제 제출 규칙 (1문장)",
      "시험/평가 관련 안내 (1문장)",
      "상담/면담 안내 (1문장)"
    ]
  }
}`;
}

// ========== HTML 템플릿 생성 ==========
export interface ReportTemplateData {
  // 학생 정보
  name: string;
  school: string;
  grade: string;
  studentPhone: string;
  parentPhone: string;
  // 행정 정보
  registrationDate: string;
  assignedClass: string;
  teacher: string;
  assignedClass2?: string;
  teacher2?: string;
  subject: string;
  preferredDays: string;
  useVehicle: string;
  location: string;
  tuitionFee: number;
  // AI 생성 데이터
  page1: {
    docNo: string;
    deptLabel: string;
    profileSummary: string;
    studentBackground?: string;
    sixFactorScores?: { factor: string; score: number; grade: string; insight: string }[];
    tendencyAnalysis?: { title: string; score: number; color: string; comment: string }[];
    managementGuide: { title: string; description: string }[];
    actionChecklist: string[];
  };
  page2: {
    welcomeTitle: string;
    welcomeSubtitle: string;
    expertDiagnosis: string;
    focusPoints: { number: string; title: string; description: string }[];
    parentMessage?: string;
    academyRules?: string[];
  };
  // 반 시간표 정보 (classes 테이블에서)
  classDays?: string;
  classTime?: string;
  clinicTime?: string;
  testDays?: string;
  testTime?: string;
  classDays2?: string;
  classTime2?: string;
  clinicTime2?: string;
  testDays2?: string;
  testTime2?: string;
  // 추가 입력사항 (폼에서 입력)
  additionalNote?: string;
  consultDate?: string;
  // 테스트/내신 점수
  testScore?: string;
  schoolScore?: string;
  // 사용자 편집 체크리스트
  checklistItems?: string[];
}

function formatFee(fee: number): string {
  return fee.toLocaleString();
}

export function buildReportHTML(data: ReportTemplateData): string {
  const bankInfo = env.NK_ACADEMY_BANK_INFO || "신한 110-383-883419";
  const bankOwner = env.NK_ACADEMY_BANK_OWNER || "노윤희";
  const vehicleFeeRaw = env.NK_ACADEMY_VEHICLE_FEE || "20000";
  const vehicleFeeNum = vehicleFeeRaw.includes("만")
    ? parseInt(vehicleFeeRaw.replace(/[^0-9]/g, "")) * 10000 || 20000
    : parseInt(vehicleFeeRaw.replace(/[^0-9]/g, "")) || 20000;
  const vehicleFeeLabel = vehicleFeeNum >= 10000 ? `${vehicleFeeNum / 10000}만원` : `${vehicleFeeNum.toLocaleString()}원`;
  const { page1, page2 } = data;
  const totalFee = data.useVehicle !== "미사용" ? data.tuitionFee + vehicleFeeNum : data.tuitionFee;
  const feeBreakdown = data.useVehicle !== "미사용"
    ? `수업료 ${formatFee(data.tuitionFee)}원 + 차량비 ${vehicleFeeLabel} (교재비 별도)`
    : "(교재비 별도)";
  const vehicleDisplay = data.useVehicle === "미사용" ? "미이용" : "이용 (O)";
  const regDateFormatted = data.registrationDate.replace(/-/g, ".");
  const payDay = data.registrationDate.split("-").pop() || "";

  // 주간테스트 스케줄 항목 HTML
  function testRow(days?: string, time?: string): string {
    if (!days && !time) return "";
    return `<div class="schedule-item" style="background:#FFFBEB;border:1px solid rgba(217,119,6,0.1)"><span class="schedule-subj" style="color:#B45309">주간 테스트</span><span class="schedule-time" style="color:#92400E">${days || ""} ${time || ""}</span></div>`;
  }

  // 요일+시간 표시 (멀티셋이면 시간에 이미 요일 포함)
  function scheduleTime(days: string | undefined, time: string | undefined, fallbackDays?: string): string {
    if (!time) return `${days || fallbackDays || ""} 시간 확인 필요`;
    if (time.includes(" / ")) return time;
    return `${days || fallbackDays || ""} ${time}`;
  }

  // 스케줄 카드 HTML
  function buildScheduleCards(): string {
    if (data.subject === "영어수학") {
      return `<div class="info-group"><div class="info-header"><div class="info-label">배정 반 / 스케줄 (수학)</div><div class="info-value">${data.assignedClass} <span style="font-size:14px;color:var(--text-sub);font-weight:500">(${data.teacher}T)</span></div></div><div class="schedule-list"><div class="schedule-item"><span class="schedule-subj">정규 수업</span><span class="schedule-time">${scheduleTime(data.classDays, data.classTime, data.preferredDays)}</span></div>${data.clinicTime ? `<div class="schedule-item"><span class="schedule-subj">클리닉</span><span class="schedule-time">${scheduleTime(data.classDays, data.clinicTime, data.preferredDays)}</span></div>` : ""}${testRow(data.testDays, data.testTime)}</div></div><div class="info-group" style="margin-top:32px;padding-top:32px;border-top:1px dashed var(--border-light)"><div class="info-header"><div class="info-label">배정 반 / 스케줄 (영어)</div><div class="info-value">${data.assignedClass2 || ""} <span style="font-size:14px;color:var(--text-sub);font-weight:500">(${data.teacher2 || ""}T)</span></div></div><div class="schedule-list"><div class="schedule-item"><span class="schedule-subj">정규 수업</span><span class="schedule-time">${scheduleTime(data.classDays2, data.classTime2, data.preferredDays)}</span></div>${data.clinicTime2 ? `<div class="schedule-item"><span class="schedule-subj">클리닉</span><span class="schedule-time">${scheduleTime(data.classDays2, data.clinicTime2, data.preferredDays)}</span></div>` : ""}${testRow(data.testDays2, data.testTime2)}</div></div>`;
    }
    if (data.subject === "영어") {
      return `<div class="info-group"><div class="info-header"><div class="info-label">배정 반 / 스케줄 (영어)</div><div class="info-value">${data.assignedClass2 || data.assignedClass} <span style="font-size:14px;color:var(--text-sub);font-weight:500">(${data.teacher2 || data.teacher}T)</span></div></div><div class="schedule-list"><div class="schedule-item"><span class="schedule-subj">정규 수업</span><span class="schedule-time">${scheduleTime(data.classDays2 || data.classDays, data.classTime2 || data.classTime, data.preferredDays)}</span></div>${(data.clinicTime2 || data.clinicTime) ? `<div class="schedule-item"><span class="schedule-subj">클리닉</span><span class="schedule-time">${scheduleTime(data.classDays2 || data.classDays, data.clinicTime2 || data.clinicTime, data.preferredDays)}</span></div>` : ""}${testRow(data.testDays2 || data.testDays, data.testTime2 || data.testTime)}</div></div>`;
    }
    return `<div class="info-group"><div class="info-header"><div class="info-label">배정 반 / 스케줄 (수학)</div><div class="info-value">${data.assignedClass} <span style="font-size:14px;color:var(--text-sub);font-weight:500">(${data.teacher}T)</span></div></div><div class="schedule-list"><div class="schedule-item"><span class="schedule-subj">정규 수업</span><span class="schedule-time">${scheduleTime(data.classDays, data.classTime, data.preferredDays)}</span></div>${data.clinicTime ? `<div class="schedule-item"><span class="schedule-subj">클리닉</span><span class="schedule-time">${scheduleTime(data.classDays, data.clinicTime, data.preferredDays)}</span></div>` : ""}${testRow(data.testDays, data.testTime)}</div></div>`;
  }

  // 7대 핵심 학습 성향 점수 HTML
  function ratingGrade(score: number): { label: string; color: string; bg: string } {
    if (score >= 4) return { label: "우수", color: "#0d9488", bg: "#f0fdfa" };
    if (score >= 3) return { label: "양호", color: "#0284c7", bg: "#f0f9ff" };
    if (score >= 2) return { label: "보통", color: "#d97706", bg: "#fffbeb" };
    return { label: "주의", color: "#dc2626", bg: "#fef2f2" };
  }

  const sixFactorHTML = (page1.sixFactorScores || []).map((item) => {
    const pct = Math.min((item.score / 5) * 100, 100);
    const r = ratingGrade(item.score);
    return `<div style="padding:16px 0;border-bottom:1px solid var(--border-light)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:14px;font-weight:700;color:var(--text-main)">${item.factor}</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:17px;font-weight:800;color:var(--primary-dark)">${item.score.toFixed(1)}</span>
          <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;background:${r.bg};color:${r.color}">${r.label}</span>
        </div>
      </div>
      <div style="height:4px;background:#E9ECEF;border-radius:4px;overflow:hidden;margin-bottom:10px"><div style="height:100%;width:${pct}%;background:var(--primary-dark);border-radius:4px"></div></div>
      ${item.insight ? `<p style="font-size:13px;color:var(--text-sub);line-height:1.6;background:#F8F9FA;padding:10px 14px;border-radius:8px;word-break:keep-all">${item.insight}</p>` : ""}
    </div>`;
  }).join("");

  // 학생 배경 HTML
  const backgroundHTML = page1.studentBackground
    ? `<div class="card" style="background:#F8F9FA;border:1px solid var(--border-light)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18" style="color:var(--primary-gold)"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          <h3 style="font-size:15px;font-weight:700;color:var(--primary-dark)">학생 배경 분석</h3>
        </div>
        <p style="font-size:14px;line-height:1.7;color:var(--text-main);word-break:keep-all">${page1.studentBackground}</p>
      </div>`
    : "";

  // 포커스 포인트 HTML
  const focusHTML = page2.focusPoints.map((item, idx) => `<div class="num-item"><div class="num-badge">${idx + 1}</div><div class="num-content"><h3>${item.title}</h3><p>${item.description}</p></div></div>`).join("");

  // 매니지먼트 가이드 HTML
  const guideHTML = page1.managementGuide.map((item, idx) => `<div class="num-item"><div class="num-badge">${idx + 1}</div><div class="num-content"><h3>${item.title}</h3><p>${item.description}</p></div></div>`).join("");

  // 체크리스트 HTML — 사용자가 체크한 항목 + AI 학생 맞춤 항목
  const userChecklist = data.checklistItems || [];
  const aiChecklist = page1.actionChecklist.map(item => {
    return item.replace(/^[\s✓✔☑✅☐☑️▶►●○•◆◇■□▪▫∙·※★☆✦✧V√\-–—:,.]+\s*/u, "").trim();
  }).filter(item => item.length > 0);
  const allChecklist = [...userChecklist, ...aiChecklist];
  const checklistHTML = allChecklist.map(item =>
    `<li class="check-item"><span class="check-bullet">▸</span>${item}</li>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>NK 등록 안내문 - ${data.name} 학생</title>
<style>
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html{scroll-behavior:smooth;scroll-padding-top:70px}
body{font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#F4F5F7;color:#111827;-webkit-font-smoothing:antialiased;line-height:1.6}
:root{--primary-dark:#11141A;--primary-dark-soft:#1E232E;--primary-gold:#B8905B;--primary-gold-light:#F4EFE6;--text-main:#1F2937;--text-sub:#6B7280;--text-light:#9CA3AF;--bg-card:#FFFFFF;--border-light:rgba(0,0,0,0.06);--shadow-sm:0 2px 8px rgba(0,0,0,0.04);--shadow-md:0 8px 24px rgba(0,0,0,0.06);--shadow-lg:0 12px 32px rgba(184,144,91,0.08);--radius-sm:8px;--radius-md:16px;--radius-lg:24px}
.wrap{max-width:480px;margin:0 auto;padding:0 0 80px;background:#FAFAFA;min-height:100vh;box-shadow:0 0 40px rgba(0,0,0,0.05);position:relative}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.animate-up{animation:fadeUp .8s cubic-bezier(.16,1,.3,1) forwards}
.hdr{background:linear-gradient(145deg,var(--primary-dark),var(--primary-dark-soft));padding:48px 24px 60px;color:#fff;position:relative;overflow:hidden;border-bottom-left-radius:32px;border-bottom-right-radius:32px}
.hdr::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;opacity:.03;mix-blend-mode:overlay;pointer-events:none}
.hdr::after{content:'';position:absolute;top:-20%;right:-10%;width:300px;height:300px;background:radial-gradient(circle,rgba(184,144,91,.15),transparent 70%);border-radius:50%;pointer-events:none}
.brand-wrap{display:flex;align-items:center;gap:8px;margin-bottom:32px;position:relative;z-index:1}
.brand-logo{width:28px;height:28px;border-radius:6px;background:linear-gradient(135deg,#D4AF37,var(--primary-gold));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;letter-spacing:.05em;box-shadow:0 4px 12px rgba(184,144,91,.3)}
.brand-name{font-size:13px;font-weight:600;color:rgba(255,255,255,.9);letter-spacing:.02em}
.hdr-sub{display:inline-block;font-size:11px;color:var(--primary-gold);letter-spacing:.05em;font-weight:700;margin-bottom:12px;padding:4px 10px;border-radius:20px;background:rgba(184,144,91,.1);border:1px solid rgba(184,144,91,.2)}
.hdr-title{font-size:26px;font-weight:800;letter-spacing:-.03em;margin-bottom:16px;line-height:1.4;color:#fff}
.hdr-desc{font-size:14px;color:rgba(255,255,255,.7);margin-bottom:32px;line-height:1.6;word-break:keep-all;position:relative;z-index:1;font-weight:400}
.profile-card{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:var(--radius-lg);padding:24px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);position:relative;z-index:1;box-shadow:0 8px 32px rgba(0,0,0,.1)}
.profile-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
.profile-name{font-size:22px;font-weight:700;color:#fff;display:flex;align-items:center;gap:8px}
.profile-badge{display:inline-flex;align-items:center;background:var(--primary-gold);padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;color:#fff;letter-spacing:-.02em}
.profile-bottom{display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,.1);padding-top:16px}
.profile-meta{display:flex;flex-direction:column;gap:4px}.meta-label{font-size:11px;color:rgba(255,255,255,.5);font-weight:500}.meta-value{font-size:13px;color:rgba(255,255,255,.9);font-weight:600}
.nav-container{position:sticky;top:0;z-index:100;padding:12px 24px;background:rgba(250,250,250,.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid rgba(0,0,0,.03)}
.nav-scroll{display:flex;gap:8px;overflow-x:auto;white-space:nowrap;-ms-overflow-style:none;scrollbar-width:none;padding-bottom:4px}.nav-scroll::-webkit-scrollbar{display:none}
.nav-scroll a{display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;font-size:14px;font-weight:600;color:var(--text-sub);text-decoration:none;border-radius:20px;transition:all .3s cubic-bezier(.4,0,.2,1);background:transparent}
.nav-scroll a:hover{color:var(--primary-dark)}.nav-scroll a.active{background:var(--primary-dark);color:#fff;box-shadow:0 4px 12px rgba(17,20,26,.15)}
.content-body{padding:0 24px;margin-top:-20px;position:relative;z-index:10}
.sec{margin-top:48px;scroll-margin-top:80px}
.sec-title{display:flex;align-items:center;gap:10px;margin-bottom:24px}.sec-title svg{width:20px;height:20px;color:var(--primary-gold)}.sec-title h2{font-size:19px;font-weight:800;color:var(--primary-dark);letter-spacing:-.02em}
.summary-box{background:#FDFBF8;border-radius:var(--radius-md);padding:28px 24px;border:1px solid #EBE4D5;box-shadow:var(--shadow-lg);margin-bottom:32px;position:relative;overflow:hidden}
.summary-box::before{content:'';position:absolute;top:0;left:0;width:4px;height:100%;background:var(--primary-gold)}
.summary-box .type-tag{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--primary-gold);margin-bottom:12px;letter-spacing:-.01em}
.summary-box p{font-size:14.5px;line-height:1.7;color:var(--text-main);word-break:keep-all}
.summary-box strong{color:var(--primary-dark);font-weight:800;background:linear-gradient(120deg,rgba(184,144,91,.2) 0%,rgba(184,144,91,0) 100%);background-repeat:no-repeat;background-size:100% 40%;background-position:0 88%}
.card{background:var(--bg-card);border:1px solid var(--border-light);border-radius:var(--radius-md);padding:28px 24px;box-shadow:var(--shadow-md);margin-bottom:24px}
.info-group{margin-bottom:24px}.info-group:last-child{margin-bottom:0}.info-header{margin-bottom:16px}
.info-label{font-size:12px;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
.info-value{font-size:16px;font-weight:700;color:var(--primary-dark)}.info-value.price{font-size:24px;color:var(--primary-gold);font-weight:800}.info-sub{font-size:13px;color:var(--text-sub);margin-top:4px}
.schedule-list{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.schedule-item{display:flex;justify-content:space-between;align-items:center;background:#F9FAFB;padding:12px 16px;border-radius:var(--radius-sm);border:1px solid rgba(0,0,0,.02)}
.schedule-subj{font-size:13px;font-weight:700;color:var(--text-main);display:flex;align-items:center;gap:6px}
.schedule-subj::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--primary-gold)}
.schedule-time{font-size:13px;color:var(--text-sub);font-weight:500}
.num-list{display:flex;flex-direction:column;gap:24px}
.num-item{display:flex;align-items:flex-start;gap:16px}
.num-badge{width:28px;height:28px;border-radius:8px;background:var(--primary-gold-light);color:var(--primary-gold);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0}
.num-content h3{font-size:15px;font-weight:700;color:var(--text-main);margin-bottom:6px;line-height:1.4}.num-content p{font-size:14px;line-height:1.6;color:var(--text-sub);word-break:keep-all}
.msg-box{background:#F3F4F6;border-radius:var(--radius-md);padding:24px;margin-top:32px}
.msg-header{display:flex;align-items:center;gap:8px;margin-bottom:12px}.msg-header svg{color:var(--primary-dark);width:18px;height:18px}.msg-header h4{font-size:15px;font-weight:700;color:var(--primary-dark)}
.msg-box p{font-size:14px;line-height:1.7;color:var(--text-main);word-break:keep-all}
.rule-list{list-style:none}.rule-item{padding:20px 0;border-bottom:1px solid var(--border-light)}.rule-item:first-child{padding-top:0}.rule-item:last-child{border-bottom:none;padding-bottom:0}
.rule-item h4{font-size:14px;font-weight:700;color:var(--text-main);margin-bottom:8px;display:flex;align-items:center;gap:6px}
.rule-item p{font-size:13.5px;color:var(--text-sub);line-height:1.6;word-break:keep-all;padding-left:14px}
.rule-sublist{margin-top:8px;padding-left:14px;list-style:none;display:flex;flex-direction:column;gap:6px}
.rule-sublist li{font-size:13.5px;color:var(--text-sub);position:relative;padding-left:10px;word-break:keep-all;line-height:1.5}
.rule-sublist li::before{content:'-';position:absolute;left:0;color:var(--text-light)}.rule-sublist li strong{color:var(--text-main);font-weight:600}
.timeline{position:relative;padding-left:28px}
.timeline::before{content:'';position:absolute;left:11px;top:8px;bottom:0;width:2px;background:linear-gradient(to bottom,var(--primary-gold) 0%,rgba(184,144,91,.2) 100%);border-radius:2px}
.time-item{position:relative;margin-bottom:32px}.time-item:last-child{margin-bottom:0}
.time-dot{position:absolute;left:-32.5px;top:4px;width:15px;height:15px;border-radius:50%;background:var(--primary-gold);border:3px solid #FAFAFA;box-shadow:0 0 0 1px rgba(184,144,91,.3);z-index:2}
.time-week{font-size:12px;font-weight:800;color:var(--primary-gold);margin-bottom:6px;letter-spacing:.05em;text-transform:uppercase}
.time-title{font-size:16px;font-weight:700;color:var(--primary-dark);margin-bottom:8px}
.time-desc{font-size:14px;line-height:1.6;color:var(--text-sub);word-break:keep-all;background:#fff;padding:16px;border-radius:var(--radius-sm);border:1px solid var(--border-light);box-shadow:var(--shadow-sm)}
.check-card{background:var(--primary-dark);border-radius:var(--radius-lg);padding:32px 24px;color:#fff;box-shadow:0 12px 32px rgba(17,20,26,.2);margin-top:24px;background-image:radial-gradient(circle at top right,rgba(255,255,255,.05) 0%,transparent 60%)}
.check-title{font-size:16px;font-weight:700;color:#fff;margin-bottom:20px;display:flex;align-items:center;gap:8px}.check-title svg{color:var(--primary-gold)}
.check-list{list-style:none;display:flex;flex-direction:column;gap:16px}
.check-item{display:flex;align-items:flex-start;gap:10px;font-size:13.5px;line-height:1.5;color:rgba(255,255,255,.8);word-break:keep-all}
.check-bullet{color:var(--primary-gold);font-size:14px;flex-shrink:0;margin-top:1px}
.footer{text-align:center;padding:48px 0 24px;font-size:12px;color:var(--text-light);font-weight:500;letter-spacing:.05em}.footer strong{color:var(--primary-dark);font-weight:700}
</style>
</head>
<body>
<div class="wrap">
  <header class="hdr animate-up">
    <div class="brand-wrap"><div class="brand-logo">NK</div><span class="brand-name">NK 교육컨설팅</span></div>
    <span class="hdr-sub">NK 심층 학습 성향 분석 기반</span>
    <h1 class="hdr-title">신입생 등록 안내서</h1>
    <p class="hdr-desc">${page2.welcomeTitle}<br>${page2.welcomeSubtitle}</p>
    <div class="profile-card">
      <div class="profile-top"><div class="profile-name">${data.name} 학생</div><div class="profile-badge">${data.school} ${data.grade}</div></div>
      <div class="profile-bottom"><div class="profile-meta"><span class="meta-label">학생 연락처</span><span class="meta-value">${data.studentPhone || "-"}</span></div><div class="profile-meta" style="text-align:right"><span class="meta-label">학부모 연락처</span><span class="meta-value">${data.parentPhone || "-"}</span></div></div>
      <div class="profile-bottom" style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1)"><div class="profile-meta"><span class="meta-label">입학 예정일</span><span class="meta-value">${regDateFormatted}</span></div><div class="profile-meta" style="text-align:right"><span class="meta-label">차량 이용</span><span class="meta-value">${vehicleDisplay}</span></div></div>${(data.testScore || data.schoolScore) ? `<div class="profile-bottom" style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1)">${data.testScore ? `<div class="profile-meta"><span class="meta-label">테스트 점수</span><span class="meta-value">${data.testScore}</span></div>` : ""}${data.schoolScore ? `<div class="profile-meta"${data.testScore ? ' style="text-align:right"' : ""}><span class="meta-label">내신 점수</span><span class="meta-value">${data.schoolScore}</span></div>` : ""}</div>` : ""}
    </div>
  </header>
  <nav class="nav-container"><div class="nav-scroll"><a href="#info" class="active">수강 안내</a><a href="#diagnosis">성향 분석</a><a href="#management">관리 전략</a></div></nav>
  <main class="content-body">
    <section class="sec animate-up" id="info" style="animation-delay:.1s">
      <div class="sec-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg><h2>수강 정보 및 안내</h2></div>
      <div class="card">${buildScheduleCards()}</div>
      <div class="card"><div class="info-group"><div class="info-header"><div class="info-label">결제 정보 (매월 ${payDay}일 기준)</div><div class="info-value price">${formatFee(totalFee)}원</div><div class="info-sub">${feeBreakdown}</div></div>
        <div class="schedule-list"><div class="schedule-item" style="flex-direction:column;align-items:flex-start;gap:4px"><span class="schedule-subj" style="color:var(--text-light);font-size:12px;font-weight:600">계좌 이체</span><span style="font-size:14px;font-weight:700;color:var(--text-main)">${bankInfo} (${bankOwner})</span><span style="font-size:12px;color:var(--primary-gold)">* 학생 이름으로 입금 요망</span></div>
        <div class="schedule-item"><span class="schedule-subj" style="color:var(--text-light);font-size:12px;font-weight:600">교육 상담</span><span style="font-size:14px;font-weight:700;color:var(--text-main)">031-401-8102</span></div></div></div></div>
      <div class="card"><h3 style="font-size:16px;font-weight:700;color:var(--primary-dark);margin-bottom:16px">학원 주요 운영 규칙</h3>
        <ul class="rule-list">
          <li class="rule-item"><h4><span style="color:var(--primary-gold)">•</span> 출결 및 보강 관리</h4><ul class="rule-sublist"><li>매 수업 <strong>10분 전 등원</strong>을 원칙으로 하며, 결석 시 학부모님의 사전 연락이 필수입니다.</li><li>무단결석 2회 또는 지각 누적 3회 발생 시 학부모 상담 및 경고 조치됩니다.</li><li><strong>보강 관리:</strong> 개인 사정에 의한 결석으로 인한 보강은 <strong>학원 자체 인강으로 대체</strong>됩니다.</li></ul></li>
          <li class="rule-item"><h4><span style="color:var(--primary-gold)">•</span> 수강료 미납 관리</h4><p>수강료는 <strong>매월 ${payDay}일 선결제</strong>가 원칙이며, 미납 시 아래와 같이 조치됩니다.</p><ul class="rule-sublist"><li><strong>1주 미납:</strong> 학부모님께 결제 안내 문자 발송</li><li><strong>2주 미납:</strong> 학생의 정규 수업 및 클리닉 참여 제한</li><li><strong>3주 이상 미납:</strong> 학원 운영 규정에 따라 자동 퇴원 처리</li></ul></li>
          <li class="rule-item"><h4><span style="color:var(--primary-gold)">•</span> 상담 및 평가</h4><ul class="rule-sublist"><li>상담은 <strong>학생 상담을 기본</strong>으로 진행합니다.</li><li>학부모님께서 궁금하신 부분이 있으실 경우, 언제든 <strong>담당 선생님께 상담을 요청</strong>하시면 됩니다.</li><li>일일/주간/월말 평가 결과는 학생의 학업 성취도 분석 자료로 활용됩니다.</li></ul></li>
          <li class="rule-item"><h4><span style="color:var(--primary-gold)">•</span> 과제 및 환불 규정</h4><ul class="rule-sublist"><li><strong>숙제 및 과제:</strong> 기한 내 제출이 원칙이며, 미제출 2회 누적 시 의무 보충 학습이 진행됩니다.</li><li><strong>교습비 환불:</strong> 교육청 반환 기준(제18조 제3항)을 엄격히 준수하여 경과율에 따라 차등 환불됩니다.</li></ul></li>
        </ul>
      </div>
    </section>
    <section class="sec animate-up" id="diagnosis" style="animation-delay:.2s">
      <div class="sec-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg><h2>NK 심층 성향 분석</h2></div>
      <div class="summary-box"><div class="type-tag"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>${page1.profileSummary || ""}</div><p>${page2.expertDiagnosis}</p></div>
      ${backgroundHTML}
      ${sixFactorHTML ? '<div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:16px"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18" style="color:var(--primary-gold)"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg><h3 style="font-size:16px;font-weight:700;color:var(--primary-dark)">7대 핵심 학습 성향</h3></div>' + sixFactorHTML + '</div>' : ''}
      <div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:16px"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18" style="color:var(--primary-gold)"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg><h3 style="font-size:16px;font-weight:700;color:var(--primary-dark)">핵심 학습 포인트</h3></div><div class="num-list">${focusHTML}</div></div>
      ${page2.parentMessage ? '<div class="msg-box"><div class="msg-header"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg><h4>학부모님께 드리는 말씀</h4></div><p>' + page2.parentMessage + '</p></div>' : ""}
    </section>
    <section class="sec animate-up" id="management" style="animation-delay:.3s">
      <div class="sec-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg><h2>담임 매니지먼트 가이드</h2></div>
      <div class="card"><div class="num-list">${guideHTML}</div></div>
      <div class="check-card"><div class="check-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>담당 선생님 필수 점검 체크리스트</div><ul class="check-list">${checklistHTML}</ul></div>
    </section>
  </main>
  <footer class="footer"><strong>NK</strong> 교육 컨설팅 그룹</footer>
</div>
<script>
document.addEventListener("DOMContentLoaded",()=>{const s=document.querySelectorAll(".sec"),n=document.querySelectorAll(".nav-scroll a"),ns=document.querySelector(".nav-scroll");window.addEventListener("scroll",()=>{let c="";s.forEach(e=>{if(scrollY>=e.offsetTop-140)c=e.getAttribute("id")});n.forEach(l=>{l.classList.remove("active");if(c&&l.getAttribute("href").includes(c)){l.classList.add("active");ns.scrollTo({left:l.offsetLeft-(ns.offsetWidth/2)+(l.offsetWidth/2),behavior:'smooth'})}})});n.forEach(l=>{l.addEventListener("click",function(e){e.preventDefault();const el=document.getElementById(this.getAttribute("href").substring(1));if(el)window.scrollTo({top:el.offsetTop-100,behavior:"smooth"})})})});
</script>
</body>
</html>`;
}

// ========== 분석 보고서 HTML 생성 (NK 성향 검사 결과지 - Premium Design) ==========
export function buildAnalysisReportHTML(analysis: Analysis): string {
  const name = analysis.name;
  const school = analysis.school || "";
  const grade = analysis.grade || "";
  const schoolInfo = `${school} ${grade}`.trim();
  const createdDate = new Date(analysis.created_at).toISOString().split("T")[0].replace(/-/g, ".");

  const hasEmotion = analysis.score_emotion != null;

  const scores: Record<string, number> = {
    attitude: analysis.score_attitude ?? 0,
    self_directed: analysis.score_self_directed ?? 0,
    assignment: analysis.score_assignment ?? 0,
    willingness: analysis.score_willingness ?? 0,
    social: analysis.score_social ?? 0,
    management: analysis.score_management ?? 0,
    ...(hasEmotion ? { emotion: analysis.score_emotion! } : {}),
  };

  const comments: Record<string, string> = {
    attitude: analysis.comment_attitude || "",
    self_directed: analysis.comment_self_directed || "",
    assignment: analysis.comment_assignment || "",
    willingness: analysis.comment_willingness || "",
    social: analysis.comment_social || "",
    management: analysis.comment_management || "",
    ...(hasEmotion ? { emotion: analysis.comment_emotion || "" } : {}),
  };

  const factorLabels: Record<string, string> = {
    attitude: "수업태도",
    self_directed: "자기주도성",
    assignment: "과제수행력",
    willingness: "학업의지",
    social: "사회성",
    management: "관리선호도",
    emotion: "심리·자신감",
  };

  const factorKeys = hasEmotion
    ? ["attitude", "self_directed", "assignment", "willingness", "social", "management", "emotion"] as const
    : ["attitude", "self_directed", "assignment", "willingness", "social", "management"] as const;

  function ratingLabel(score: number): string {
    if (score >= 4) return "우수";
    if (score >= 3) return "양호";
    if (score >= 2) return "보통";
    return "주의";
  }

  // Nav items (dynamic based on data)
  const navItems: { id: string; label: string }[] = [
    { id: "summary", label: "성향 요약" },
    { id: "factors", label: hasEmotion ? "7대 성향" : "6대 성향" },
    { id: "strengths", label: "주요 강점" },
    { id: "weaknesses", label: "개선 영역" },
  ];
  if (analysis.paradox && analysis.paradox.length > 0) {
    navItems.push({ id: "gap", label: "간극 분석" });
  }
  if (analysis.solutions && analysis.solutions.length > 0) {
    navItems.push({ id: "solution", label: "맞춤 솔루션" });
  }
  if (analysis.final_assessment) {
    navItems.push({ id: "final", label: "맞춤 지도" });
  }

  const navHTML = navItems.map((n, i) =>
    `<li><a href="#${n.id}"${i === 0 ? ' class="active"' : ''}>${n.label}</a></li>`
  ).join("");

  // Factor items
  const factorItemsHTML = factorKeys.map((key) => {
    const s = scores[key];
    const c = comments[key];
    const pct = Math.min((s / 5) * 100, 100);
    return `<div class="factor-item">
          <div class="factor-header">
            <span class="title">${factorLabels[key]}</span>
            <div class="score-wrap">
              <span class="score">${s.toFixed(1)}</span>
              <span class="badge">${ratingLabel(s)}</span>
            </div>
          </div>
          <div class="progress-bg"><div class="progress-fill" style="width:${pct}%"></div></div>
          ${c ? `<div class="factor-desc">${c}</div>` : ""}
        </div>`;
  }).join("");

  // Strengths
  const strengthsHTML = (analysis.strengths || []).map((item, idx) =>
    `<div class="list-item">
            <div class="list-num">${idx + 1}</div>
            <div class="list-text">
              <h3>${item.title}</h3>
              <p>${item.description}</p>
            </div>
          </div>`
  ).join("") || '<p style="font-size:13px;color:var(--text-sub)">데이터 없음</p>';

  // Weaknesses
  const weaknessesHTML = (analysis.weaknesses || []).map((item, idx) =>
    `<div class="list-item">
            <div class="list-num">${idx + 1}</div>
            <div class="list-text">
              <h3>${item.title}</h3>
              <p>${item.description}</p>
            </div>
          </div>`
  ).join("") || '<p style="font-size:13px;color:var(--text-sub)">데이터 없음</p>';

  // Paradox / Gap
  function parseParadoxValue(raw: unknown): { num: number; str: string } {
    if (raw == null) return { num: 0, str: "-" };
    const s = String(raw).trim();
    const n = Number(s);
    if (!isNaN(n) && s !== "") return { num: n, str: s };
    const numMatch = s.match(/(\d+\.?\d*)/);
    if (numMatch) return { num: Number(numMatch[1]), str: s };
    const textMap: Record<string, number> = {
      "매우 높음": 5, "매우높음": 5, "높음": 4, "높은": 4, "강함": 4, "많음": 4, "적극적": 4,
      "보통": 3, "중간": 3, "평균": 3, "낮음": 2, "낮은": 2, "약함": 2, "적음": 2, "소극적": 2,
      "매우 낮음": 1, "매우낮음": 1, "부족": 1,
    };
    for (const [key, val] of Object.entries(textMap)) {
      if (s.includes(key)) return { num: val, str: s };
    }
    return { num: 0, str: s };
  }

  const gapHTML = (analysis.paradox || []).map((item, idx) => {
    const title = String(item.title || "");
    const desc = String(item.description || "");
    let lbl1 = "", lbl2 = "";
    let p1 = { num: 0, str: "-" }, p2 = { num: 0, str: "-" };

    if ("label1" in item && "label2" in item) {
      lbl1 = String(item.label1); lbl2 = String(item.label2);
      p1 = parseParadoxValue(item.value1);
      p2 = parseParadoxValue(item.value2);
    } else if ("studentView" in item && "nkView" in item) {
      lbl1 = "학생 인식"; lbl2 = "NK 평가";
      p1 = parseParadoxValue(item.studentView);
      p2 = parseParadoxValue(item.nkView);
    }

    const barsHTML = (p1.num > 0 || p2.num > 0)
      ? `<div class="gap-bars">
            <div class="gap-row">
              <span class="gap-label">${lbl1}</span>
              <div class="gap-bar-bg"><div class="gap-bar-fill" style="width:${Math.min((p1.num / 5) * 100, 100)}%;background:var(--primary-dark)"></div></div>
              <span class="gap-score">${p1.num > 0 ? p1.num.toFixed(1) : p1.str}</span>
            </div>
            <div class="gap-row">
              <span class="gap-label">${lbl2}</span>
              <div class="gap-bar-bg"><div class="gap-bar-fill" style="width:${Math.min((p2.num / 5) * 100, 100)}%;background:var(--accent-burgundy)"></div></div>
              <span class="gap-score">${p2.num > 0 ? p2.num.toFixed(1) : p2.str}</span>
            </div>
          </div>`
      : `<div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap">
            <span style="font-size:12px;font-weight:600;color:var(--primary-dark);background:#F1F3F5;padding:4px 12px;border-radius:4px">${lbl1}: ${p1.str}</span>
            <span style="font-size:12px;font-weight:600;color:var(--accent-burgundy);background:var(--accent-burgundy-light);padding:4px 12px;border-radius:4px">${lbl2}: ${p2.str}</span>
          </div>`;

    return `<div class="gap-card">
          <div class="gap-header">
            <span class="badge">분석 ${idx + 1}</span>
            <h3>${title}</h3>
          </div>
          ${barsHTML}
          <p class="gap-desc">${desc}</p>
        </div>`;
  }).join("");

  // Solutions
  const solutionHTML = (analysis.solutions || []).map((sol) => {
    const actionsHTML = (sol.actions || []).map((a) =>
      `<li>${a}</li>`
    ).join("");
    return `<div class="step-card">
          <div class="step-header">
            <span class="step-title">${sol.step}단계 과정</span>
            <span class="step-period">${sol.weeks}</span>
          </div>
          <div class="step-body">
            <h4>${sol.goal}</h4>
            <ul class="step-list">${actionsHTML}</ul>
          </div>
        </div>`;
  }).join("");

  // Average score
  const avgScore = factorKeys.reduce((sum, k) => sum + scores[k], 0) / factorKeys.length;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <title>NK 성향분석 - ${name}</title>
  <style>
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
    *{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth;scroll-padding-top:64px}
    body{font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',serif;background:#f8f9fa;color:#212529;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
    :root{--primary-dark:#1A1D24;--primary-gold:#C6A87C;--gold-light:#F2EDE4;--text-main:#2C3038;--text-sub:#6C727D;--border-light:#E9ECEF;--accent-burgundy:#7A3B3B;--accent-burgundy-light:#F8EFEF}
    .wrap{max-width:480px;margin:0 auto;padding:0 0 60px;background:#fff;min-height:100vh;box-shadow:0 0 40px rgba(0,0,0,0.05)}
    .hdr{background:linear-gradient(145deg,var(--primary-dark),#2B303B);padding:40px 24px 32px;color:#fff;position:relative;overflow:hidden}
    .hdr::after{content:'';position:absolute;top:-30%;right:-20%;width:250px;height:250px;background:radial-gradient(circle,rgba(198,168,124,0.15),transparent 70%);border-radius:50%}
    .hdr .brand{display:flex;align-items:center;gap:8px;margin-bottom:24px;position:relative;z-index:1}
    .hdr .brand .logo{width:28px;height:28px;border-radius:4px;background:var(--primary-gold);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;letter-spacing:0.05em}
    .hdr .brand span{font-size:12px;font-weight:500;color:rgba(255,255,255,0.7);letter-spacing:0.02em}
    .hdr .sub{font-size:11px;color:var(--primary-gold);letter-spacing:0.05em;font-weight:600;margin-bottom:6px}
    .hdr h1{font-size:24px;font-weight:800;letter-spacing:-0.02em;margin-bottom:32px;line-height:1.3}
    .hdr .info-card{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;backdrop-filter:blur(10px);position:relative;z-index:1}
    .hdr .info-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
    .hdr .name{font-size:20px;font-weight:700;color:#fff}
    .hdr .avg{display:inline-flex;align-items:center;background:rgba(198,168,124,0.15);border:1px solid rgba(198,168,124,0.3);padding:4px 12px;border-radius:4px;font-size:12px;font-weight:700;color:var(--primary-gold)}
    .hdr .info-bottom{display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.1);padding-top:12px}
    .hdr .meta{font-size:12px;color:rgba(255,255,255,0.6)}
    .nav-wrap{position:sticky;top:0;z-index:100;background:rgba(255,255,255,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid rgba(198,168,124,0.2);box-shadow:0 4px 20px rgba(0,0,0,0.03);overflow-x:auto;white-space:nowrap;-ms-overflow-style:none;scrollbar-width:none}
    .nav-wrap::-webkit-scrollbar{display:none}
    .nav-menu{display:flex;padding:0 24px;list-style:none;gap:24px}
    .nav-menu li{display:inline-block}
    .nav-menu a{display:block;padding:16px 0;font-size:14px;font-weight:700;color:var(--text-sub);text-decoration:none;position:relative;transition:color 0.3s ease}
    .nav-menu a:hover,.nav-menu a.active{color:var(--primary-dark)}
    .nav-menu a::after{content:'';position:absolute;bottom:0;left:0;width:0;height:2px;background:var(--primary-gold);transition:width 0.3s ease}
    .nav-menu a:hover::after,.nav-menu a.active::after{width:100%}
    .content-body{padding:0 24px}
    .sec{margin-top:40px}
    .sec-title{display:flex;align-items:center;gap:10px;margin-bottom:20px}
    .sec-title::before{content:'';display:block;width:3px;height:16px;background:var(--primary-gold)}
    .sec-title h2{font-size:17px;font-weight:800;color:var(--text-main);letter-spacing:-0.02em}
    .summary-box{background:var(--gold-light);border-radius:12px;padding:24px;border:1px solid rgba(198,168,124,0.3);box-shadow:0 8px 24px rgba(198,168,124,0.08)}
    .summary-box .type-tag{display:inline-block;font-size:12px;font-weight:700;padding:6px 14px;border-radius:4px;background:var(--primary-gold);color:#fff;margin-bottom:16px;letter-spacing:-0.01em}
    .summary-box p{font-size:14px;line-height:1.75;color:var(--text-main);word-break:keep-all}
    .factor-item{padding:20px 0;border-bottom:1px solid var(--border-light)}
    .factor-item:last-child{border-bottom:none;padding-bottom:0}
    .factor-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
    .factor-header .title{font-size:15px;font-weight:700;color:var(--text-main)}
    .factor-header .score-wrap{display:flex;align-items:center;gap:8px}
    .factor-header .score{font-size:18px;font-weight:800;color:var(--primary-dark)}
    .factor-header .badge{font-size:11px;font-weight:600;padding:3px 8px;border-radius:4px;background:#F1F3F5;color:var(--text-sub)}
    .progress-bg{height:4px;background:#E9ECEF;border-radius:4px;overflow:hidden;margin-bottom:16px}
    .progress-fill{height:100%;background:var(--primary-dark);border-radius:4px}
    .factor-desc{font-size:13.5px;color:var(--text-sub);line-height:1.65;word-break:keep-all;background:#F8F9FA;padding:14px 16px;border-radius:8px}
    .list-card{border:1px solid var(--border-light);border-radius:12px;padding:24px 20px;box-shadow:0 8px 24px rgba(0,0,0,0.02)}
    .list-item{display:flex;align-items:flex-start;gap:14px;margin-bottom:24px}
    .list-item:last-child{margin-bottom:0}
    .list-num{width:24px;height:24px;border-radius:50%;background:#F1F3F5;color:var(--text-sub);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
    .list-text h3{font-size:15px;font-weight:700;color:var(--text-main);margin-bottom:6px}
    .list-text p{font-size:13.5px;line-height:1.65;color:var(--text-sub);word-break:keep-all}
    .weakness-card .list-num{background:var(--accent-burgundy-light);color:var(--accent-burgundy)}
    .weakness-card .list-text h3{color:var(--accent-burgundy)}
    .gap-card{background:#fff;border:1px solid var(--border-light);border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 8px 24px rgba(0,0,0,0.02)}
    .gap-header{display:flex;align-items:center;gap:10px;margin-bottom:16px}
    .gap-header .badge{background:var(--gold-light);color:#A68B61;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px}
    .gap-header h3{font-size:14px;font-weight:700;color:var(--text-main)}
    .gap-bars{display:flex;flex-direction:column;gap:12px;margin-bottom:16px;padding:16px;background:#F8F9FA;border-radius:8px}
    .gap-row{display:flex;align-items:center;gap:12px}
    .gap-label{font-size:12px;font-weight:600;color:var(--text-sub);width:55px;flex-shrink:0}
    .gap-bar-bg{flex:1;height:6px;background:#E9ECEF;border-radius:4px;overflow:hidden}
    .gap-bar-fill{height:100%;border-radius:4px}
    .gap-score{font-size:12px;font-weight:700;color:var(--text-main);width:24px;text-align:right}
    .gap-desc{font-size:13px;color:var(--text-sub);line-height:1.65;margin:0}
    .step-card{border:1px solid var(--border-light);border-radius:12px;overflow:hidden;margin-bottom:16px;box-shadow:0 8px 24px rgba(0,0,0,0.02)}
    .step-header{background:#F8F9FA;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-light)}
    .step-header .step-title{font-size:14px;font-weight:800;color:var(--primary-dark)}
    .step-header .step-period{font-size:12px;font-weight:600;color:var(--text-sub)}
    .step-body{padding:20px}
    .step-body h4{font-size:14.5px;font-weight:700;color:var(--text-main);margin-bottom:14px}
    .step-list{list-style:none}
    .step-list li{display:flex;align-items:flex-start;gap:8px;font-size:13.5px;color:var(--text-sub);line-height:1.6;margin-bottom:8px}
    .step-list li::before{content:'\\2022';color:var(--primary-gold);font-size:14px;font-weight:bold}
    .step-list li:last-child{margin-bottom:0}
    .final-box{background:var(--primary-dark);border-radius:12px;padding:32px 24px;color:#fff;text-align:center}
    .final-box h3{font-size:18px;font-weight:700;color:var(--primary-gold);margin-bottom:16px}
    .final-box p{font-size:14px;line-height:1.8;color:rgba(255,255,255,0.85);word-break:keep-all;text-align:left}
    .footer{text-align:center;padding:40px 0 20px;font-size:12px;color:var(--text-sub);font-weight:500;letter-spacing:0.05em}
    .footer span{color:var(--primary-gold);font-weight:700}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <div class="brand">
        <div class="logo">NK</div>
        <span>NK EDUCATION</span>
      </div>
      <div class="sub">맞춤형 심층 분석 보고서</div>
      <h1>NK 성향 검사 결과지</h1>
      <div class="info-card">
        <div class="info-top">
          <div class="name">${name} 학생</div>
          <div class="avg">종합 ${avgScore.toFixed(1)}점</div>
        </div>
        <div class="info-bottom">
          <div class="meta">${schoolInfo}</div>
          <div class="meta">${createdDate}</div>
        </div>
      </div>
    </div>
    <nav class="nav-wrap">
      <ul class="nav-menu">${navHTML}</ul>
    </nav>
    <div class="content-body">
      <div class="sec" id="summary">
        <div class="sec-title"><h2>학생 성향 요약</h2></div>
        <div class="summary-box">
          ${analysis.student_type ? `<span class="type-tag">${analysis.student_type}</span>` : ""}
          <p>${analysis.summary || ""}</p>
        </div>
      </div>
      <div class="sec" id="factors">
        <div class="sec-title"><h2>${hasEmotion ? "7" : "6"}대 핵심 학습 성향</h2></div>
        ${factorItemsHTML}
      </div>
      <div class="sec" id="strengths">
        <div class="sec-title"><h2>주요 강점</h2></div>
        <div class="list-card">${strengthsHTML}</div>
      </div>
      <div class="sec" id="weaknesses">
        <div class="sec-title"><h2>보완 및 개선 영역</h2></div>
        <div class="list-card weakness-card">${weaknessesHTML}</div>
      </div>
      ${(analysis.paradox && analysis.paradox.length > 0) ? `
      <div class="sec" id="gap">
        <div class="sec-title"><h2>심리적 간극 분석</h2></div>
        ${gapHTML}
      </div>` : ""}
      ${(analysis.solutions && analysis.solutions.length > 0) ? `
      <div class="sec" id="solution">
        <div class="sec-title"><h2>12주 맞춤 솔루션</h2></div>
        ${solutionHTML}
      </div>` : ""}
      ${analysis.final_assessment ? `
      <div class="sec" id="final">
        <div class="final-box">
          <h3>NK 학습 맞춤 지도</h3>
          <p>${analysis.final_assessment}</p>
        </div>
      </div>` : ""}
    </div>
    <div class="footer"><span>NK</span> EDUCATION</div>
  </div>
  <script>
    document.addEventListener("DOMContentLoaded",()=>{const s=document.querySelectorAll(".sec"),n=document.querySelectorAll(".nav-menu a");window.addEventListener("scroll",()=>{let c="";s.forEach(e=>{if(scrollY>=e.offsetTop-120)c=e.getAttribute("id")});n.forEach(l=>{l.classList.remove("active");if(c&&l.getAttribute("href").includes(c)){l.classList.add("active");const w=document.querySelector(".nav-wrap"),a=l.parentElement;if(a){w.scrollTo({left:a.offsetLeft-(w.offsetWidth/2)+(a.offsetWidth/2),behavior:"smooth"})}}})});n.forEach(l=>{l.addEventListener("click",function(e){e.preventDefault();const t=document.getElementById(this.getAttribute("href").substring(1));if(t)window.scrollTo({top:t.offsetTop-60,behavior:"smooth"})})})});
  </script>
</body>
</html>`;
}
