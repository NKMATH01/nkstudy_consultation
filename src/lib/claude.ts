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
    await new Promise((r) => setTimeout(r, 2000 * (retryCount + 1)));
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

  text += "\n=== 6-Factor 평균 점수 ===\n";
  const factorKeys = ["attitude", "self_directed", "assignment", "willingness", "social", "management"] as const;
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
  const vehicleFee = env.NK_ACADEMY_VEHICLE_FEE || "2만원";
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
관리선호: ${analysis.score_management}점
종합요약: ${analysis.summary}

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
      {"factor": "관리선호", "score": 4.0, "grade": "...", "insight": "..."}
    ],
    "managementGuide": [
      {"title": "가이드 제목 1", "description": "상세 설명 (2문장, 담임이 실행할 구체적 행동)"},
      {"title": "가이드 제목 2", "description": "상세 설명 (2문장)"},
      {"title": "가이드 제목 3", "description": "상세 설명 (2문장)"}
    ],
    "firstMonthPlan": [
      {"week": "1주차", "goal": "목표", "actions": "구체적 실행 사항 (1~2문장)"},
      {"week": "2주차", "goal": "목표", "actions": "구체적 실행 사항 (1~2문장)"},
      {"week": "3주차", "goal": "목표", "actions": "구체적 실행 사항 (1~2문장)"},
      {"week": "4주차", "goal": "목표", "actions": "구체적 실행 사항 (1~2문장)"}
    ],
    "actionChecklist": [
      "체크리스트 항목 1", "체크리스트 항목 2", "체크리스트 항목 3",
      "체크리스트 항목 4", "체크리스트 항목 5", "체크리스트 항목 6"
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
    firstMonthPlan?: { week: string; goal: string; actions: string }[];
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
  classDays2?: string;
  classTime2?: string;
  clinicTime2?: string;
}

function scoreColor(color: string): string {
  const map: Record<string, string> = {
    indigo: "#4f46e5",
    red: "#ef4444",
    orange: "#f97316",
    emerald: "#10b981",
  };
  return map[color] || "#64748b";
}

function scorePercent(score: number): number {
  return Math.round((score / 5) * 100);
}

function formatFee(fee: number): string {
  return fee.toLocaleString();
}

function vehicleText(useVehicle: string, vehicleFee: string): string {
  if (useVehicle === "미사용") return "미이용";
  return `이용 (월 ${vehicleFee})`;
}

function feeWithVehicle(fee: number, useVehicle: string): string {
  const vehicleFeeNum = 20000; // 기본 2만원
  const total = useVehicle !== "미사용" ? fee + vehicleFeeNum : fee;
  const suffix = useVehicle !== "미사용" ? "(차량비 포함 / 교재비 별도)" : "(교재비 별도)";
  return `${formatFee(total)}원<span style="font-size:10px;font-weight:normal;color:#94a3b8;margin-left:4px">${suffix}</span>`;
}

function scheduleRow(label: string, value: string): string {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:4px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);margin-bottom:8px">
    <span style="color:#cbd5e1;font-size:12px">${label}</span>
    <span style="font-weight:700;color:white;font-size:12px;text-align:right">${value}</span>
  </div>`;
}

function buildScheduleSection(data: ReportTemplateData): string {
  const mathDays = data.classDays || data.preferredDays || "";
  const engDays = data.classDays2 || data.preferredDays || "";

  if (data.subject === "영어수학") {
    const rows: string[] = [];
    rows.push(scheduleRow("수학 담임", `${data.teacher} 선생님`));
    rows.push(scheduleRow("수학 수업", data.classTime ? `[${mathDays}] ${data.classTime}` : "시간표 확인 필요"));
    if (data.clinicTime) rows.push(scheduleRow("수학 클리닉", `[${mathDays}] ${data.clinicTime}`));
    rows.push(scheduleRow("영어 담임", `${data.teacher2 || ""} 선생님`));
    rows.push(scheduleRow("영어 수업", data.classTime2 ? `[${engDays}] ${data.classTime2}` : "시간표 확인 필요"));
    if (data.clinicTime2) rows.push(scheduleRow("영어 클리닉", `[${engDays}] ${data.clinicTime2}`));
    return rows.join("");
  }

  if (data.subject === "영어") {
    const rows: string[] = [];
    rows.push(scheduleRow("담임 선생님", `${data.teacher2 || data.teacher} 선생님`));
    rows.push(scheduleRow("영어 수업", data.classTime2 ? `[${engDays}] ${data.classTime2}` : data.classTime ? `[${engDays}] ${data.classTime}` : "시간표 확인 필요"));
    const clinic = data.clinicTime2 || data.clinicTime;
    if (clinic) rows.push(scheduleRow("영어 클리닉", `[${engDays}] ${clinic}`));
    return rows.join("");
  }

  // 수학 (기본)
  const rows: string[] = [];
  rows.push(scheduleRow("담임 선생님", `${data.teacher} 선생님`));
  rows.push(scheduleRow("수학 수업", data.classTime ? `[${mathDays}] ${data.classTime}` : "시간표 확인 필요"));
  if (data.clinicTime) rows.push(scheduleRow("수학 클리닉", `[${mathDays}] ${data.clinicTime}`));
  return rows.join("");
}

export function buildReportHTML(data: ReportTemplateData): string {
  const bankInfo = env.NK_ACADEMY_BANK_INFO || "신한은행 110-383-883419";
  const bankOwner = env.NK_ACADEMY_BANK_OWNER || "노윤희";
  const vehicleFee = env.NK_ACADEMY_VEHICLE_FEE || "2만원";
  const vehicleFeeNum = parseInt(vehicleFee.replace(/[^0-9]/g, "")) * 10000 || 20000;
  const { page1, page2 } = data;

  const classLabel = data.subject === "영어수학"
    ? `수학: ${data.assignedClass} (${data.teacher}) / 영어: ${data.assignedClass2 || ""} (${data.teacher2 || ""})`
    : `${data.assignedClass} (${data.teacher} 선생님)`;

  // 6-Factor 테이블
  const sixFactorHTML = page1.sixFactorScores ? page1.sixFactorScores.map((item) => {
    const gradeColors: Record<string, string> = { "우수": "#059669", "양호": "#0284c7", "보통": "#d97706", "주의": "#dc2626" };
    const gc = gradeColors[item.grade] || "#64748b";
    return `<tr>
      <td style="border:1px solid #e2e8f0;padding:8px 12px;font-weight:700;font-size:12px;color:#1e293b;white-space:nowrap">${item.factor}</td>
      <td style="border:1px solid #e2e8f0;padding:8px 10px;text-align:center;font-weight:800;color:#1e40af;font-size:13px">${item.score.toFixed(1)}</td>
      <td style="border:1px solid #e2e8f0;padding:8px 10px;text-align:center;white-space:nowrap"><span style="font-size:11px;font-weight:700;color:${gc};background:${gc}15;padding:3px 12px;border-radius:10px;white-space:nowrap">${item.grade}</span></td>
      <td style="border:1px solid #e2e8f0;padding:8px 10px;font-size:11px;color:#64748b;line-height:1.5">${item.insight}</td>
    </tr>`;
  }).join("") : (page1.tendencyAnalysis || []).map((item) => `<tr>
    <td style="border:1px solid #e2e8f0;padding:8px 12px;font-weight:700;font-size:12px;color:#1e293b;white-space:nowrap">${item.title}</td>
    <td style="border:1px solid #e2e8f0;padding:8px 10px;text-align:center;font-weight:800;color:${scoreColor(item.color)};font-size:13px">${item.score.toFixed(1)}</td>
    <td style="border:1px solid #e2e8f0;padding:8px 10px;text-align:center;white-space:nowrap"><span style="font-size:11px;font-weight:700;color:${scoreColor(item.color)};white-space:nowrap">${item.score >= 4 ? "우수" : item.score >= 3 ? "양호" : item.score >= 2 ? "보통" : "주의"}</span></td>
    <td style="border:1px solid #e2e8f0;padding:8px 10px;font-size:11px;color:#64748b;line-height:1.5">${item.comment}</td>
  </tr>`).join("");

  const guideHTML = page1.managementGuide.slice(0, 3).map((item, idx) => `
    <div style="padding:12px 16px;border-left:4px solid #3730a3;background:#f8fafc;margin-bottom:8px;border-radius:0 8px 8px 0">
      <p style="font-weight:800;color:#1e293b;font-size:13px;margin:0">${idx + 1}. ${item.title}</p>
      <p style="font-size:12px;color:#64748b;margin:5px 0 0;line-height:1.6">${item.description}</p>
    </div>
  `).join("");

  const guideHTML2 = page1.managementGuide.slice(3).map((item, idx) => `
    <div style="padding:12px 16px;border-left:4px solid #3730a3;background:#f8fafc;margin-bottom:8px;border-radius:0 8px 8px 0">
      <p style="font-weight:800;color:#1e293b;font-size:13px;margin:0">${idx + 4}. ${item.title}</p>
      <p style="font-size:12px;color:#64748b;margin:5px 0 0;line-height:1.6">${item.description}</p>
    </div>
  `).join("");

  const firstMonthHTML = (page1.firstMonthPlan || []).map((item) => `
    <div style="padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;text-align:center;background:#fafbff">
      <p style="font-size:11px;font-weight:800;color:#4f46e5;margin:0 0 4px;background:#eef2ff;padding:3px 10px;border-radius:6px;display:inline-block">${item.week}</p>
      <p style="font-size:12px;font-weight:700;color:#1e293b;margin:4px 0 4px">${item.goal}</p>
      <p style="font-size:11px;color:#64748b;margin:0;line-height:1.5">${item.actions}</p>
    </div>
  `).join("");

  const checklistHTML = page1.actionChecklist.map((item) =>
    `<p style="margin:0 0 5px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;background:#4f46e5;border-radius:3px;margin-right:6px;vertical-align:middle;color:white;font-size:10px;font-weight:900;line-height:1">✓</span>${item}</p>`
  ).join("");

  const focusHTML = page2.focusPoints.map((item) => `
    <div style="padding:12px 14px;background:white;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <div style="width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#6366f1);display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:10px;flex-shrink:0">${item.number}</div>
        <h4 style="font-weight:800;color:#0f172a;font-size:12px;margin:0">${item.title}</h4>
      </div>
      <p style="font-size:11px;color:#64748b;line-height:1.6;margin:0;padding-left:28px">${item.description}</p>
    </div>
  `).join("");

  // 학년별 수업료 테이블 (현재 학생 학년 하이라이트)
  const tuitionRows = [
    { grade: "초3", fee: 280000 }, { grade: "초4~5", fee: 300000 }, { grade: "초6~중1", fee: 320000 },
    { grade: "중2~3", fee: 350000 }, { grade: "고1", fee: 380000 }, { grade: "고2~3", fee: 400000 },
  ];
  const currentGrade = data.grade;
  const tuitionTableHTML = tuitionRows.map((row) => {
    const isActive = row.grade.includes(currentGrade) ||
      (row.grade === "초4~5" && ["초4", "초5"].includes(currentGrade)) ||
      (row.grade === "초6~중1" && ["초6", "중1"].includes(currentGrade)) ||
      (row.grade === "중2~3" && ["중2", "중3"].includes(currentGrade)) ||
      (row.grade === "고2~3" && ["고2", "고3"].includes(currentGrade));
    const bg = isActive ? "background:#eef2ff;font-weight:800" : "";
    const marker = isActive ? ' style="color:#4f46e5;font-weight:900"' : "";
    return `<tr style="${bg}">
      <td style="border:1px solid #e2e8f0;padding:6px 10px;font-size:11px;text-align:center"${marker}>${isActive ? "▶ " : ""}${row.grade}</td>
      <td style="border:1px solid #e2e8f0;padding:6px 10px;font-size:11px;text-align:right;font-weight:700"${marker}>${row.fee.toLocaleString()}원</td>
    </tr>`;
  }).join("");

  // 공통 헤더/푸터 스타일
  const pageFooter = (num: number, total: number) =>
    `<div style="margin-top:auto;padding-top:10px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e2e8f0;color:#94a3b8">
      <p style="font-size:9px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase">NK Education</p>
      <p style="font-size:9px;font-family:monospace">PAGE ${String(num).padStart(2, "0")} / ${String(total).padStart(2, "0")}</p>
    </div>`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NK 교육 - ${data.name} 학생 등록 안내 리포트</title>
<link href="https://fonts.googleapis.com/css2?family=Pretendard:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
:root{--nk-main:#0f172a;--nk-accent:#3730a3;--nk-text:#1e293b;--nk-border:#e2e8f0;--app-bg:#334155}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Pretendard',sans-serif;background:var(--app-bg);padding:40px 0;display:flex;flex-direction:column;align-items:center;gap:40px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;background:white;padding:14mm 15mm;position:relative;display:flex;flex-direction:column;box-shadow:0 0 20px rgba(0,0,0,0.5);margin:0 auto;overflow:hidden}
.pdf-btn{position:fixed;top:20px;right:20px;z-index:9999;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;border:none;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 15px rgba(79,70,229,0.4);font-family:'Pretendard',sans-serif;display:flex;align-items:center;gap:8px;transition:all 0.2s}
.pdf-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(79,70,229,0.5)}
@page{size:A4;margin:0}
@media print{body{background:none;padding:0;gap:0;margin:0}.page{margin:0;padding:14mm 15mm;box-shadow:none;page-break-after:always;page-break-inside:avoid;break-after:page;break-inside:avoid}.no-print{display:none!important}}
</style>
</head>
<body>
<button class="pdf-btn no-print" onclick="window.print()">&#128196; PDF 다운로드</button>

<!-- ===== PAGE 1: 학부모 등록 안내문 ===== -->
<div class="page" id="page1">
  <div style="position:absolute;top:0;left:0;width:100%;height:10px;background:linear-gradient(90deg,#4f46e5,#7c3aed)"></div>

  <div style="text-align:center;padding:22px 0 14px;margin-bottom:14px;border-bottom:2px solid #f1f5f9">
    <p style="color:#3730a3;font-weight:600;letter-spacing:0.3em;text-transform:uppercase;margin-bottom:6px;font-size:10px">Premium Academic Consulting</p>
    <h2 style="font-weight:900;font-size:34px;color:#0f172a;margin-bottom:2px;letter-spacing:-0.02em">
      ${data.name} <span style="font-size:18px;font-weight:300;color:#94a3b8;margin-left:4px">학생</span>
    </h2>
    <div style="width:40px;height:3px;background:linear-gradient(90deg,#4f46e5,#7c3aed);border-radius:2px;margin:8px auto"></div>
    <p style="font-size:14px;color:#475569;font-weight:400;line-height:1.6">${page2.welcomeTitle}<br>${page2.welcomeSubtitle}</p>
  </div>

  <!-- 등록 정보 + 시간표 -->
  <div style="display:flex;gap:12px;margin-bottom:14px">
    <div style="flex:1;background:white;border:1px solid #e2e8f0;padding:14px 16px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.04)">
      <h3 style="font-weight:900;font-size:14px;color:#1e293b;margin-bottom:10px"><span style="color:#6366f1;margin-right:5px">&#128196;</span>등록 정보</h3>
      <div style="font-size:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:7px"><span style="color:#64748b">수업 시작일</span><span style="font-weight:700;color:#3730a3;background:#eef2ff;padding:2px 10px;border-radius:4px">${data.registrationDate}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:7px"><span style="color:#64748b">수업 장소</span><span style="font-weight:700;color:#1e293b">${data.location || "미정"}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:7px"><span style="color:#64748b">차량 운행</span><span style="font-weight:700;color:#1e293b">${data.useVehicle === "미사용" ? "미이용" : `이용 (월 ${vehicleFee})`}</span></div>
        <div style="display:flex;justify-content:space-between;padding-top:7px;border-top:1px solid #f1f5f9"><span style="color:#64748b">월 교육비</span><span style="font-weight:800;font-size:15px;color:#0f172a">${formatFee(data.tuitionFee)}원<span style="font-size:11px;font-weight:normal;color:#94a3b8;margin-left:3px">(교재비 별도)</span></span></div>
      </div>
    </div>
    <div style="flex:1;background:linear-gradient(135deg,#0f172a,#1e293b);padding:14px 16px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.15);color:white">
      <h3 style="font-weight:900;font-size:14px;color:white;margin-bottom:10px"><span style="color:#818cf8;margin-right:5px">&#128336;</span>Weekly Schedule</h3>
      <div style="font-size:12px">${buildScheduleSection(data)}</div>
    </div>
  </div>

  <!-- Expert Diagnosis -->
  <div style="padding:14px 18px;border-radius:10px;background:linear-gradient(135deg,rgba(238,242,255,0.6),rgba(224,231,255,0.4));border:1px solid #c7d2fe;margin-bottom:14px">
    <h3 style="font-weight:900;font-size:11px;color:#1e1b4b;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.15em">Expert Diagnosis</h3>
    <p style="font-size:12px;color:#334155;line-height:1.7;text-align:justify;margin:0">${page2.expertDiagnosis}</p>
  </div>

  <!-- 핵심 포인트 2x2 -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">${focusHTML}</div>

  <!-- 학부모님께 드리는 말씀 -->
  ${page2.parentMessage ? `
  <div style="background:linear-gradient(135deg,#faf5ff,#f5f3ff);border:1px solid #e9d5ff;border-radius:10px;padding:16px 18px">
    <h3 style="font-weight:900;font-size:12px;color:#6b21a8;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em">&#128140; 학부모님께 드리는 말씀</h3>
    <p style="font-size:12px;color:#4c1d95;line-height:1.7;margin:0">${page2.parentMessage}</p>
  </div>` : ""}

  ${pageFooter(1, 4)}
</div>

<!-- ===== PAGE 2: 원비 안내 및 학원 운영 규정 ===== -->
<div class="page" id="page2">
  <div style="position:absolute;top:0;left:0;width:100%;height:10px;background:linear-gradient(90deg,#4f46e5,#7c3aed)"></div>

  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:2px;margin-bottom:14px;border-bottom:2px solid #e2e8f0;padding-bottom:10px">
    <div>
      <h1 style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.05em;font-style:italic;text-transform:uppercase;margin:0">NK EDUCATION</h1>
      <p style="color:#3730a3;font-weight:700;font-size:10px;letter-spacing:0.3em;margin-top:3px">원비 안내 및 학원 운영 규정</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:11px;font-weight:700;color:#1e293b">${data.name} / ${data.school} ${data.grade}</p>
    </div>
  </div>

  <!-- 1. 월 수업료 안내 -->
  <div style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:900;color:#1e293b;margin-bottom:8px">
    <span style="color:#4f46e5">&#9632;</span> 1. 월 수업료 안내
  </div>
  <div style="display:flex;gap:12px;margin-bottom:12px">
    <div style="flex:1">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="background:#1e1b4b;color:white">
          <th style="padding:6px 10px;text-align:center;font-size:11px;border:1px solid #1e1b4b">학년</th>
          <th style="padding:6px 10px;text-align:center;font-size:11px;border:1px solid #1e1b4b">월 수업료</th>
        </tr></thead>
        <tbody>${tuitionTableHTML}</tbody>
      </table>
      <p style="font-size:9px;color:#94a3b8;margin-top:4px">* 교재비는 별도이며, 학기 초 안내됩니다.</p>
    </div>
    <div style="flex:1">
      <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:12px;margin-bottom:8px">
        <p style="font-size:11px;font-weight:800;color:#3730a3;margin:0 0 6px">&#127775; 복수 과목 할인 (영어수학 동시 수강)</p>
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <tr><td style="padding:4px 0;color:#475569">중등부 (초6~중3)</td><td style="text-align:right;font-weight:700;color:#dc2626">-50,000원 할인</td></tr>
          <tr><td style="padding:4px 0;color:#475569">고등부 (고1~고3)</td><td style="text-align:right;font-weight:700;color:#dc2626">-30,000원 할인</td></tr>
        </table>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px">
        <p style="font-size:11px;font-weight:800;color:#166534;margin:0 0 5px">&#128652; 차량 운행</p>
        <p style="font-size:11px;color:#475569;line-height:1.5;margin:0">월 ${vehicleFee} (왕복 기준)<br>차량 운행 노선 및 시간은 별도 안내</p>
      </div>
    </div>
  </div>

  <!-- 이 학생의 원비 요약 -->
  <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:12px;padding:14px 20px;color:white;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
    <div>
      <p style="font-size:11px;color:#818cf8;font-weight:700;margin:0 0 3px">&#128176; ${data.name} 학생 월 납부 금액</p>
      <p style="font-size:11px;color:#94a3b8;margin:0">${data.subject} · ${data.grade} · 차량 ${data.useVehicle === "미사용" ? "미이용" : "이용"}</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:26px;font-weight:900;color:white;margin:0">${formatFee(data.useVehicle !== "미사용" ? data.tuitionFee + vehicleFeeNum : data.tuitionFee)}원</p>
      <p style="font-size:10px;color:#94a3b8;margin:2px 0 0">${data.useVehicle !== "미사용" ? `수업료 ${formatFee(data.tuitionFee)}원 + 차량비 ${vehicleFee}` : "수업료"} (교재비 별도)</p>
    </div>
  </div>

  <!-- 2. 납부 안내 -->
  <div style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:900;color:#1e293b;margin-bottom:6px">
    <span style="color:#4f46e5">&#9632;</span> 2. 납부 안내
  </div>
  <div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px 16px;margin-bottom:10px;font-size:11px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:5px 0;color:#64748b;width:80px;font-weight:600;border-bottom:1px solid #f1f5f9">입금 계좌</td><td style="padding:5px 0;font-weight:800;color:#1e1b4b;border-bottom:1px solid #f1f5f9">${bankInfo} <span style="font-size:10px;background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:4px;font-weight:600;margin-left:4px">예금주: ${bankOwner}</span></td></tr>
      <tr><td style="padding:5px 0;color:#64748b;font-weight:600;border-bottom:1px solid #f1f5f9">납부 방법</td><td style="padding:5px 0;font-weight:700;color:#1e293b;border-bottom:1px solid #f1f5f9">${data.name} (학생 이름) 입금 · 매월 등록일(${data.registrationDate.split("-").pop() || ""}일) 기준</td></tr>
      <tr><td style="padding:5px 0;color:#64748b;font-weight:600;border-bottom:1px solid #f1f5f9">카드 결제</td><td style="padding:5px 0;font-weight:700;color:#1e293b;border-bottom:1px solid #f1f5f9"><span style="color:#4f46e5;font-weight:800">다온카드</span> <span style="font-size:10px;color:#64748b">(현장결제)</span> · <span style="font-weight:800;color:#1e293b">일반카드</span> <span style="font-size:10px;color:#64748b">(학원 전화 후 카드번호 직접 결제 가능)</span></td></tr>
      <tr><td style="padding:5px 0;color:#64748b;font-weight:600">교육 상담</td><td style="padding:5px 0;font-weight:700;color:#1e293b">031-401-8102</td></tr>
    </table>
  </div>

  <!-- 미납 시 조치 -->
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 14px;margin-bottom:10px">
    <p style="font-size:10px;font-weight:800;color:#991b1b;margin:0 0 3px">&#9888;&#65039; 수업료 미납 시 조치 사항</p>
    <p style="font-size:10px;color:#7f1d1d;line-height:1.5;margin:0"><strong>1주 미납</strong>: 납부 안내 연락 (문자/전화) · <strong>2주 미납</strong>: 수업 참여 불가 · <strong>3주 이상</strong>: 자동 퇴원 처리</p>
  </div>

  <!-- 3. 학원 운영 규칙 -->
  <div style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:900;color:#1e293b;margin-bottom:5px">
    <span style="color:#4f46e5">&#9632;</span> 3. 학원 운영 규칙
  </div>
  <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:10px">
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <tr style="background:#f8fafc"><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;width:75px;font-weight:700;color:#475569;vertical-align:top">출결 관리</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;color:#1e293b;line-height:1.5">매 수업일 정시 출석 필수이며, 부득이한 결석 시 <strong>사전 연락</strong> 바랍니다. 지각 누적 3회 시 학부모님께 안내드립니다.</td></tr>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#475569;vertical-align:top">숙제/과제</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;color:#1e293b;line-height:1.5">매 수업 후 과제가 출제되며, 정해진 기한 내 제출을 원칙으로 합니다. 미제출 2회 누적 시 보충 학습이 진행됩니다.</td></tr>
      <tr style="background:#f8fafc"><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#475569;vertical-align:top">시험/평가</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;color:#1e293b;line-height:1.5">일일, 주간, 월말평가가 진행되며, 결과는 정기 상담 시 함께 검토합니다.</td></tr>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#475569;vertical-align:top">정기 상담</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;color:#1e293b;line-height:1.5">학생, 학부모 월 1회 정기 상담을 진행하며, 학습 진행 상황 및 진로 등을 함께 논의합니다.</td></tr>
      <tr style="background:#f8fafc"><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#475569;vertical-align:top">보강</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;color:#1e293b;line-height:1.5">개인 사정으로 인한 보강은 <strong>인강(인터넷 강의)으로 대체</strong>됩니다.</td></tr>
      <tr><td style="padding:6px 12px;font-weight:700;color:#475569;vertical-align:top">기타 사항</td><td style="padding:6px 12px;color:#1e293b;line-height:1.5">학원 내 휴대폰 사용은 제한되며, 수업 분위기 저해 행위 시 학부모 면담 후 조치합니다.</td></tr>
    </table>
  </div>

  <!-- 4. 환불 규정 -->
  <div style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:900;color:#1e293b;margin-bottom:6px">
    <span style="color:#4f46e5">&#9632;</span> 4. 환불 규정
  </div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:11px;color:#475569;line-height:1.7">
    <p style="margin:0 0 4px;font-size:12px"><strong style="color:#1e293b">교육청 「교습비 등 반환 기준」을 엄격히 준수합니다.</strong></p>
    <ul style="margin:0;padding-left:16px">
      <li>수업 시작 전: 이미 납부한 교습비 전액 환불</li>
      <li>총 교습 시간의 1/3 경과 전: 이미 납부한 교습비의 2/3 해당액 환불</li>
      <li>총 교습 시간의 1/2 경과 전: 이미 납부한 교습비의 1/2 해당액 환불</li>
      <li>총 교습 시간의 1/2 경과 후: 환불하지 않음</li>
    </ul>
  </div>

  ${pageFooter(2, 4)}
</div>

<!-- ===== PAGE 3: 신입생 분석 전략서 (내부용) ===== -->
<div class="page" id="page3">
  <div style="position:absolute;top:0;left:0;width:100%;height:8px;background:#1e1b4b"></div>
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:2px;margin-bottom:16px;border-bottom:2px solid #e2e8f0;padding-bottom:10px">
    <div>
      <h1 style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.05em;font-style:italic;text-transform:uppercase;margin:0">NK EDUCATION</h1>
      <p style="color:#3730a3;font-weight:700;font-size:10px;letter-spacing:0.3em;margin-top:3px">신입생 통합 분석 및 관리 전략서 (${page1.deptLabel})</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:10px;color:#94a3b8;font-family:monospace">Doc. No: ${page1.docNo}</p>
    </div>
  </div>

  <!-- 1. 프로필 -->
  <div style="display:flex;align-items:center;gap:5px;font-size:14px;font-weight:900;color:#1e293b;margin-bottom:10px">
    <span style="color:#4f46e5">&#9632;</span> 1. 신입생 핵심 프로필
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px">
    <tr>
      <th style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;width:85px;color:#475569;font-weight:700">성명/학교</th>
      <td style="border:1px solid #e2e8f0;padding:8px 12px;font-weight:700;color:#0f172a">${data.name} / ${data.school} ${data.grade}</td>
      <th style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;width:85px;color:#475569;font-weight:700">등록 예정일</th>
      <td style="border:1px solid #e2e8f0;padding:8px 12px;color:#0f172a">${data.registrationDate}</td>
    </tr>
    <tr>
      <th style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;color:#475569;font-weight:700">배정반</th>
      <td style="border:1px solid #e2e8f0;padding:8px 12px;color:#3730a3;font-weight:700">${classLabel}</td>
      <th style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;color:#475569;font-weight:700">차량</th>
      <td style="border:1px solid #e2e8f0;padding:8px 12px;color:#64748b">${vehicleText(data.useVehicle, vehicleFee)}</td>
    </tr>
    <tr>
      <th style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;color:#475569;font-weight:700">진단 요약</th>
      <td colspan="3" style="border:1px solid #e2e8f0;padding:8px 12px"><span style="color:#dc2626;font-weight:800;font-size:12px">${page1.profileSummary}</span></td>
    </tr>
    ${page1.studentBackground ? `<tr>
      <th style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;color:#475569;font-weight:700">학생 배경</th>
      <td colspan="3" style="border:1px solid #e2e8f0;padding:8px 12px;font-size:11px;color:#475569;line-height:1.6">${page1.studentBackground}</td>
    </tr>` : ""}
  </table>

  <!-- 2. 6-Factor -->
  <div style="display:flex;align-items:center;gap:5px;font-size:14px;font-weight:900;color:#1e293b;margin-bottom:10px">
    <span style="color:#4f46e5">&#9632;</span> 2. 6-Factor 학습 성향 분석
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
    <thead><tr style="background:#f8fafc">
      <th style="border:1px solid #e2e8f0;padding:8px 12px;font-size:11px;color:#475569;font-weight:700;text-align:left;width:85px">항목</th>
      <th style="border:1px solid #e2e8f0;padding:8px 10px;font-size:11px;color:#475569;font-weight:700;text-align:center;width:50px">점수</th>
      <th style="border:1px solid #e2e8f0;padding:8px 10px;font-size:11px;color:#475569;font-weight:700;text-align:center;width:55px">등급</th>
      <th style="border:1px solid #e2e8f0;padding:8px 12px;font-size:11px;color:#475569;font-weight:700;text-align:left">핵심 인사이트</th>
    </tr></thead>
    <tbody>${sixFactorHTML}</tbody>
  </table>

  <!-- 3. 매니지먼트 가이드 -->
  <div style="display:flex;align-items:center;gap:5px;font-size:14px;font-weight:900;color:#1e293b;margin-bottom:10px">
    <span style="color:#4f46e5">&#9632;</span> 3. 담임 매니지먼트 가이드 (${data.teacher} 선생님)
  </div>
  <div style="margin-bottom:14px">${guideHTML}</div>

  ${pageFooter(3, 4)}
</div>

<!-- ===== PAGE 4: 적응 전략 및 실행 계획 (내부용) ===== -->
<div class="page" id="page4">
  <div style="position:absolute;top:0;left:0;width:100%;height:8px;background:#1e1b4b"></div>
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:2px;margin-bottom:16px;border-bottom:2px solid #e2e8f0;padding-bottom:10px">
    <div>
      <h1 style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.05em;font-style:italic;text-transform:uppercase;margin:0">NK EDUCATION</h1>
      <p style="color:#3730a3;font-weight:700;font-size:10px;letter-spacing:0.3em;margin-top:3px">적응 전략 및 실행 계획</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:11px;font-weight:700;color:#1e293b">${data.name} / ${data.school} ${data.grade}</p>
    </div>
  </div>

  <!-- 매니지먼트 가이드 나머지 -->
  ${guideHTML2 ? `
  <div style="display:flex;align-items:center;gap:5px;font-size:14px;font-weight:900;color:#1e293b;margin-bottom:10px">
    <span style="color:#4f46e5">&#9632;</span> 3. 담임 매니지먼트 가이드 (계속)
  </div>
  <div style="margin-bottom:18px">${guideHTML2}</div>` : ""}

  <!-- 4. 첫 달 적응 로드맵 -->
  ${firstMonthHTML ? `
  <div style="display:flex;align-items:center;gap:5px;font-size:14px;font-weight:900;color:#1e293b;margin-bottom:10px">
    <span style="color:#4f46e5">&#9632;</span> 4. 첫 달(4주) 적응 로드맵
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">${firstMonthHTML}</div>` : ""}

  <!-- 5. Action Checklist -->
  <div style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:16px 18px;border-radius:12px;color:white;margin-bottom:18px">
    <p style="font-size:12px;font-weight:900;color:#818cf8;margin-bottom:10px;border-bottom:1px solid #475569;padding-bottom:7px;text-transform:uppercase;letter-spacing:0.05em">Required Action Checklist</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px 18px;opacity:0.95">${checklistHTML}</div>
  </div>

  <!-- 학생 배경 상세 -->
  ${page1.studentBackground ? `
  <div style="display:flex;align-items:center;gap:5px;font-size:14px;font-weight:900;color:#1e293b;margin-bottom:10px">
    <span style="color:#4f46e5">&#9632;</span> 5. 학생 배경 분석 및 유의사항
  </div>
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin-bottom:18px">
    <p style="font-size:12px;color:#92400e;line-height:1.7;margin:0">${page1.studentBackground}</p>
  </div>` : ""}

  <div style="background:linear-gradient(135deg,#f8fafc,#f1f5f9);border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;text-align:center">
    <p style="font-size:11px;font-weight:700;color:#475569;margin:0">NK EDUCATION은 학생 한 명 한 명의 성장을 위해 최선을 다하겠습니다.</p>
  </div>

  ${pageFooter(4, 4)}
</div>

</body>
</html>`;
}

// ========== 분석 보고서 HTML 생성 (NK 심층 학습 성향 분석서) ==========
export function buildAnalysisReportHTML(analysis: Analysis): string {
  const name = analysis.name;
  const school = analysis.school || "";
  const grade = analysis.grade || "";
  const schoolInfo = `${school} ${grade}`.trim();
  const createdDate = new Date(analysis.created_at).toISOString().split("T")[0].replace(/-/g, ".");

  const scores = {
    attitude: analysis.score_attitude ?? 0,
    self_directed: analysis.score_self_directed ?? 0,
    assignment: analysis.score_assignment ?? 0,
    willingness: analysis.score_willingness ?? 0,
    social: analysis.score_social ?? 0,
    management: analysis.score_management ?? 0,
  };

  const comments = {
    attitude: analysis.comment_attitude || "",
    self_directed: analysis.comment_self_directed || "",
    assignment: analysis.comment_assignment || "",
    willingness: analysis.comment_willingness || "",
    social: analysis.comment_social || "",
    management: analysis.comment_management || "",
  };

  const factorLabels: Record<string, string> = {
    attitude: "수업태도",
    self_directed: "자기주도성",
    assignment: "과제수행력",
    willingness: "학업의지",
    social: "사회성",
    management: "관리선호",
  };

  const factorKeys = ["attitude", "self_directed", "assignment", "willingness", "social", "management"] as const;

  function tagClass(score: number): string {
    if (score >= 4) return "tag-emerald";
    if (score >= 3) return "tag-teal";
    return "tag-rose";
  }

  function tagLabel(score: number): string {
    if (score >= 4) return "우수";
    if (score >= 3) return "양호";
    if (score >= 2) return "보통";
    return "주의";
  }

  // Score table rows (3 columns: 항목, 점수, 전문가 코멘트)
  const scoreTableRows = factorKeys.map((key) => {
    const s = scores[key];
    const c = comments[key];
    const isHigh = s >= 4;
    return `<tr>
      <td>${isHigh ? `<span style="color:#2563eb;font-weight:700">${factorLabels[key]}</span>` : factorLabels[key]}</td>
      <td style="text-align:center;font-weight:700">${s.toFixed(1)}</td>
      <td>${c}</td>
    </tr>`;
  }).join("");

  // Strengths bullet list
  const strengthsList = (analysis.strengths || []).map((item) =>
    `<li style="display:flex;align-items:flex-start;margin-bottom:8px">
      <svg class="bullet-icon" style="color:#2563eb" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
      <span style="font-size:8.5pt;color:#374151;line-height:1.5"><strong style="color:#2563eb">${item.title}:</strong> ${item.description}</span>
    </li>`
  ).join("");

  // Weaknesses bullet list
  const weaknessesList = (analysis.weaknesses || []).map((item) =>
    `<li style="display:flex;align-items:flex-start;margin-bottom:8px">
      <svg class="bullet-icon" style="color:#dc2626" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
      <span style="font-size:8.5pt;color:#374151;line-height:1.5"><strong style="color:#dc2626">${item.title}:</strong> ${item.description}</span>
    </li>`
  ).join("");

  // Paradox cards with CSS bar charts
  function parseParadoxValue(raw: unknown): { num: number; str: string } {
    if (raw == null) return { num: 0, str: "-" };
    const s = String(raw).trim();
    // Try direct number parse
    const n = Number(s);
    if (!isNaN(n) && s !== "") return { num: n, str: s };
    // Extract number from string like "4.2점", "3점"
    const numMatch = s.match(/(\d+\.?\d*)/);
    if (numMatch) return { num: Number(numMatch[1]), str: s };
    // Map Korean text labels to numeric scale
    const textMap: Record<string, number> = {
      "매우 높음": 5, "매우높음": 5,
      "높음": 4, "높은": 4, "강함": 4, "많음": 4, "적극적": 4,
      "보통": 3, "중간": 3, "평균": 3,
      "낮음": 2, "낮은": 2, "약함": 2, "적음": 2, "소극적": 2,
      "매우 낮음": 1, "매우낮음": 1, "부족": 1,
    };
    for (const [key, val] of Object.entries(textMap)) {
      if (s.includes(key)) return { num: val, str: s };
    }
    return { num: 0, str: s };
  }

  const paradoxCards = (analysis.paradox || []).map((item, idx) => {
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

    const hasNumeric = p1.num > 0 || p2.num > 0;
    const barLabel1 = p1.num > 0 ? p1.num.toFixed(1) : p1.str;
    const barLabel2 = p2.num > 0 ? p2.num.toFixed(1) : p2.str;

    const barsHTML = hasNumeric
      ? `<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:8pt;font-weight:700;color:#64748b;width:55px;flex-shrink:0">${lbl1}</span>
          <div style="flex:1;background:#f3f4f6;height:16px;border-radius:4px;overflow:hidden">
            <div style="width:${Math.min((p1.num / 5) * 100, 100)}%;height:100%;background:#2563eb;border-radius:4px;font-size:7pt;color:white;text-align:center;line-height:16px;min-width:${p1.num > 0 ? "30px" : "0"}">${barLabel1}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:8pt;font-weight:700;color:#ef4444;width:55px;flex-shrink:0">${lbl2}</span>
          <div style="flex:1;background:#f3f4f6;height:16px;border-radius:4px;overflow:hidden">
            <div style="width:${Math.min((p2.num / 5) * 100, 100)}%;height:100%;background:#ef4444;border-radius:4px;font-size:7pt;color:white;text-align:center;line-height:16px;min-width:${p2.num > 0 ? "30px" : "0"}">${barLabel2}</div>
          </div>
        </div>
      </div>`
      : `<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
        <span style="display:inline-block;font-size:8pt;font-weight:700;color:#1e40af;background:#dbeafe;padding:4px 10px;border-radius:6px">${lbl1}: ${p1.str}</span>
        <span style="display:inline-block;font-size:8pt;font-weight:700;color:#991b1b;background:#fee2e2;padding:4px 10px;border-radius:6px">${lbl2}: ${p2.str}</span>
      </div>`;
    return `<div class="card-box" style="flex:1">
      <h4 style="font-size:9pt;font-weight:700;color:#4b5563;margin:0 0 8px;padding-bottom:8px;border-bottom:1px solid #e5e7eb">Paradox ${idx + 1}: ${title}</h4>
      ${barsHTML}
      <p style="font-size:8pt;color:#6b7280;line-height:1.5;margin:0;text-align:justify">${desc}</p>
    </div>`;
  }).join("");

  // Solutions STEP cards
  const stepTextColors = ["#1e40af", "#4c1d95", "#92400e", "#065f46"];
  const stepBgColors = ["#dbeafe", "#e0e7ff", "#ffedd5", "#d1fae5"];
  const stepBorderColors = ["#93c5fd", "#a5b4fc", "#fdba74", "#6ee7b7"];
  const stepBulletColors = ["#3b82f6", "#6366f1", "#f97316", "#10b981"];
  const solutionCards = (analysis.solutions || []).map((sol, idx) => {
    const textColor = stepTextColors[idx % stepTextColors.length];
    const bgColor = stepBgColors[idx % stepBgColors.length];
    const borderColor = stepBorderColors[idx % stepBorderColors.length];
    const bulletColor = stepBulletColors[idx % stepBulletColors.length];
    const actionsHTML = (sol.actions || []).map((a) =>
      `<li style="display:flex;align-items:flex-start;margin-bottom:4px">
        <svg class="bullet-icon" style="color:${bulletColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
        <span>${a}</span>
      </li>`
    ).join("");
    return `<div style="display:flex;margin-bottom:12px">
      <div style="width:80px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${bgColor};border-radius:8px 0 0 8px;border-right:1px solid ${borderColor};padding:12px 0">
        <span style="font-size:13pt;font-weight:900;color:${textColor}">STEP ${sol.step}</span>
        <span style="font-size:8pt;font-weight:700;color:${textColor};opacity:0.7">${sol.weeks}</span>
      </div>
      <div style="flex:1;border:1px solid #e5e7eb;border-left:0;border-radius:0 8px 8px 0;padding:14px 16px;background:white">
        <h4 style="font-weight:700;font-size:10pt;color:#1e293b;margin:0 0 6px">${sol.goal}</h4>
        <ul style="margin:0;padding:0;list-style:none;font-size:8.5pt;color:#374151;line-height:1.6">${actionsHTML}</ul>
      </div>
    </div>`;
  }).join("");

  // PAGE 1 Content
  const page1 = `
    <!-- Header -->
    <header class="header-bar">
      <div>
        <h1 style="font-size:22pt;font-weight:900;color:#1f2937;letter-spacing:-0.02em;margin:0">NK 심층 학습 성향 분석서</h1>
        <p style="font-size:9pt;color:#2563eb;font-weight:700;margin:4px 0 0">PREMIUM CONSULTING REPORT</p>
      </div>
      <div style="text-align:right">
        <div style="font-size:18pt;font-weight:700;color:#374151">${name} 학생</div>
        <p style="font-size:9pt;color:#6b7280;margin:2px 0 0">${schoolInfo}</p>
        <p style="font-size:8pt;color:#9ca3af;margin:2px 0 0">작성일자: ${createdDate}</p>
      </div>
    </header>

    <!-- 1. Executive Summary -->
    <section style="margin-bottom:20px">
      <div class="card-box" style="background:#f8fafc;border-color:#e2e8f0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h2 style="font-size:12pt;font-weight:800;color:#334155;display:flex;align-items:center;margin:0">
            <svg class="svg-icon" style="color:#1e40af" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
            Executive Summary (총평 보고)
          </h2>
          <span class="tag tag-indigo">유형: ${analysis.student_type || "-"}</span>
        </div>
        <p style="font-size:9pt;color:#374151;line-height:1.7;margin:0;text-align:justify">${analysis.summary || ""}</p>
      </div>
    </section>

    <!-- 2. Charts Section (2-column) -->
    <section style="display:flex;gap:14px;margin-bottom:14px;height:330px">
      <div class="card-box" style="flex:1;display:flex;flex-direction:column">
        <div class="section-title">
          <svg style="color:#1d4ed8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg>
          6-Factor 성향 분석 (Bar Analysis)
        </div>
        <div style="position:relative;flex:1;width:100%">
          <canvas id="factorChart"></canvas>
        </div>
      </div>
      <div class="card-box" style="flex:1;display:flex;flex-direction:column">
        <div class="section-title">
          <svg style="color:#1d4ed8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
          지표별 세부 분석
        </div>
        <div style="flex:1;display:flex;align-items:center">
          <table class="grid-table" style="width:100%">
            <thead>
              <tr>
                <th style="width:22%">항목</th>
                <th style="width:15%;text-align:center">점수</th>
                <th>전문가 코멘트</th>
              </tr>
            </thead>
            <tbody>${scoreTableRows}</tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- 3. Core Competency Matrix -->
    <section style="display:flex;flex-direction:column;margin-top:0">
      <div class="section-title">
        <svg style="color:#1d4ed8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>
        Core Competency Matrix (핵심 역량 분석)
      </div>
      <div style="display:flex;gap:14px">
        <div class="card-box" style="flex:1;background:#eff6ff;border-color:#bfdbfe;display:flex;flex-direction:column">
          <h3 style="color:#1e40af;font-weight:700;font-size:10pt;margin:0 0 8px;display:flex;align-items:center;border-bottom:1px solid #bfdbfe;padding-bottom:8px">
            <svg class="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"></path></svg>
            Strength (강점)
          </h3>
          <ul style="list-style:none;padding:0;margin:0">
            ${strengthsList || '<li style="font-size:8.5pt;color:#9ca3af">데이터 없음</li>'}
          </ul>
        </div>
        <div class="card-box" style="flex:1;background:#fef2f2;border-color:#fecaca;display:flex;flex-direction:column">
          <h3 style="color:#991b1b;font-weight:700;font-size:10pt;margin:0 0 8px;display:flex;align-items:center;border-bottom:1px solid #fecaca;padding-bottom:8px">
            <svg class="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            Weakness (개선영역)
          </h3>
          <ul style="list-style:none;padding:0;margin:0">
            ${weaknessesList || '<li style="font-size:8.5pt;color:#9ca3af">데이터 없음</li>'}
          </ul>
        </div>
      </div>
    </section>

    <footer class="footer">
      <span>NK Academy Consulting Group</span>
      <span>Page 1 of 2</span>
    </footer>`;

  // PAGE 2 Content
  const page2 = `
    <!-- Header -->
    <header class="header-bar">
      <div>
        <h1 style="font-size:17pt;font-weight:700;color:#1f2937;margin:0">Action Plan &amp; Roadmap</h1>
        <p style="font-size:8pt;color:#6b7280;margin:2px 0 0">${schoolInfo} ${name} 학생/학습 맞춤 솔루션</p>
      </div>
      <div style="text-align:right">
        <span class="tag tag-blue" style="font-size:9pt">${analysis.student_type || ""}</span>
      </div>
    </header>

    <!-- 4. Psychological Gap Analysis -->
    ${(analysis.paradox && analysis.paradox.length > 0) ? `
    <section style="margin-bottom:40px">
      <div class="section-title">
        <svg style="color:#1d4ed8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
        Psychological Gap Analysis (심리/행동 괴리 분석)
      </div>
      <div style="display:flex;gap:14px">
        ${paradoxCards}
      </div>
    </section>` : ""}

    <!-- 5. 12-Week Solution -->
    ${(analysis.solutions && analysis.solutions.length > 0) ? `
    <section style="margin-bottom:40px">
      <div class="section-title">
        <svg style="color:#1d4ed8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
        NK 12-Week Intensive Solution (12주 집중 솔루션)
      </div>
      <div>
        ${solutionCards}
      </div>
    </section>` : ""}

    <!-- 6. Final Assessment -->
    ${analysis.final_assessment ? `
    <section style="margin-top:0">
      <div class="card-box" style="background:#1f2937;border:none;padding:16px;color:white">
        <h3 style="font-size:11pt;font-weight:700;color:#93c5fd;margin:0 0 8px;display:flex;align-items:center">
          <svg class="svg-icon" style="color:#93c5fd" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path></svg>
          NK 최종 의견 (Final Assessment)
        </h3>
        <p style="font-size:9pt;font-weight:300;line-height:1.7;margin:0;opacity:0.95;text-align:justify">${analysis.final_assessment}</p>
      </div>
    </section>` : ""}

    <footer class="footer">
      <span>NK Academy Consulting Group</span>
      <span>Page 2 of 2</span>
    </footer>`;

  // Chart.js initialization - horizontal bar chart with score-based colors
  const scoreValues = [scores.attitude, scores.self_directed, scores.assignment, scores.willingness, scores.social, scores.management];
  const barColors = scoreValues.map(v => v >= 3.5 ? 'rgba(37,99,235,0.7)' : 'rgba(156,163,175,0.7)');
  const chartScript = `
    var ctx = document.getElementById('factorChart');
    if (ctx) {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['수업태도', '자기주도성', '과제수행력', '학업의지', '사회성', '관리선호'],
          datasets: [{
            label: '성향 점수',
            data: [${scoreValues.join(",")}],
            backgroundColor: ${JSON.stringify(barColors)},
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 4,
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { max: 5, min: 0, grid: { color: '#f3f4f6' }, ticks: { stepSize: 1 } },
            y: { grid: { display: false }, ticks: { font: { weight: 'bold' } } }
          }
        }
      });
    }
    `;

  return buildAnalysisReportTemplateHTML({
    studentName: name,
    schoolInfo,
    page1Content: page1,
    page2Content: page2,
    chartScript,
  });
}

function buildAnalysisReportTemplateHTML(data: {
  studentName: string;
  schoolInfo: string;
  page1Content: string;
  page2Content: string;
  chartScript: string;
}): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NK 심층 학습 성향 분석서 - ${data.studentName}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Pretendard:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Pretendard', sans-serif; background-color: #525659; margin: 0; padding: 20px 0; display: flex; flex-direction: column; align-items: center; color: #1f2937; }
        #report-wrapper { width: 210mm; margin: 0 auto; }
        .page { width: 210mm; height: 297mm; background: white; padding: 12mm 15mm; margin-bottom: 10mm; box-shadow: 0 0 15px rgba(0,0,0,0.1); display: flex; flex-direction: column; position: relative; overflow: hidden; }
        @media print { body { background: none; padding: 0; } .page { margin: 0; box-shadow: none; page-break-after: always; } .no-print { display: none !important; } .download-btn-group { display: none; } }
        body.pdf-mode .page { margin: 0 !important; box-shadow: none !important; }
        .header-bar { border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: end; }
        .section-title { font-size: 13pt; font-weight: 800; color: #1e3a8a; display: flex; align-items: center; margin-bottom: 12px; border-left: 5px solid #2563eb; padding-left: 10px; background: linear-gradient(90deg, #eff6ff 0%, rgba(255,255,255,0) 100%); }
        .section-title svg { width: 20px; height: 20px; margin-right: 8px; stroke-width: 2; flex-shrink: 0; }
        .card-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background-color: #fff; }
        .grid-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
        .grid-table th { background-color: #f3f4f6; color: #374151; font-weight: 700; text-align: left; padding: 6px 8px; border-bottom: 2px solid #e5e7eb; }
        .grid-table td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; color: #4b5563; }
        .grid-table tr:last-child td { border-bottom: none; }
        .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 8pt; font-weight: 700; }
        .tag-blue { background-color: #dbeafe; color: #1e40af; }
        .tag-red { background-color: #fee2e2; color: #991b1b; }
        .tag-green { background-color: #dcfce7; color: #166534; }
        .tag-teal { background-color: #ccfbf1; color: #0f766e; }
        .tag-rose { background-color: #ffe4e6; color: #be123c; }
        .tag-emerald { background-color: #d1fae5; color: #065f46; }
        .tag-indigo { background-color: #e0e7ff; color: #3730a3; }
        .tag-orange { background-color: #ffedd5; color: #9a3412; }
        .tag-purple { background-color: #f3e8ff; color: #6b21a8; }
        .svg-icon { width: 20px; height: 20px; margin-right: 8px; stroke-width: 2; }
        .bullet-icon { width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: text-top; margin-top: 2px; flex-shrink: 0; }
        .footer { position: absolute; bottom: 12mm; left: 15mm; right: 15mm; border-top: 1px solid #e5e7eb; padding-top: 8px; display: flex; justify-content: space-between; font-size: 8pt; color: #9ca3af; }
        .download-btn-group { position: fixed; bottom: 30px; right: 30px; display: flex; flex-direction: column; gap: 10px; z-index: 1000; }
        .download-btn { background-color: #2563eb; color: white; padding: 12px 20px; border-radius: 50px; box-shadow: 0 4px 15px rgba(37,99,235,0.3); font-weight: bold; display: flex; align-items: center; cursor: pointer; transition: all 0.3s; border: none; font-size: 14px; }
        .download-btn:hover { background-color: #1d4ed8; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(37,99,235,0.4); }
        .download-btn svg { width: 16px; height: 16px; margin-right: 8px; }
        #pdf-loading-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.7); display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 9999; color: white; text-align: center; backdrop-filter: blur(5px); }
        .spinner { border: 6px solid #f3f3f3; border-top: 6px solid #2563eb; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin-bottom: 20px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div id="pdf-loading-overlay" style="display: none;">
        <div class="spinner"></div>
        <p>이미지 파일을 생성 중입니다. 잠시만 기다려주세요...</p>
    </div>
    <div class="download-btn-group">
        <button class="download-btn" onclick="downloadImage(1)">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            1페이지 다운로드
        </button>
        <button class="download-btn" onclick="downloadImage(2)">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            2페이지 다운로드
        </button>
    </div>
    <div id="report-wrapper">
        <div class="page" id="page1">${data.page1Content}</div>
        <div class="page" id="page2">${data.page2Content}</div>
    </div>
    <script>
        Chart.defaults.font.family = "'Pretendard', sans-serif";
        Chart.defaults.font.size = 10;
        Chart.defaults.color = '#4b5563';
        Chart.defaults.animation = false;
        ${data.chartScript}
        async function downloadImage(pageNum) {
            var overlay = document.getElementById('pdf-loading-overlay');
            overlay.style.display = 'flex';
            try {
                var studentName = "${data.studentName}";
                var schoolInfo = "${data.schoolInfo}";
                var baseFilename = 'nk성향분석_' + schoolInfo + '_' + studentName;
                var pageElement = document.getElementById('page' + pageNum);
                if (!pageElement) throw new Error("Page not found");
                document.body.classList.add('pdf-mode');
                var canvas = await html2canvas(pageElement, { scale: 2, useCORS: true, logging: false, windowWidth: pageElement.scrollWidth, windowHeight: pageElement.scrollHeight });
                var imgData = canvas.toDataURL('image/png');
                var link = document.createElement("a");
                link.download = baseFilename + '_' + pageNum + '페이지.png';
                link.href = imgData;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (error) {
                console.error("Image Error:", error);
                alert("이미지 생성 중 오류가 발생했습니다.");
            } finally {
                overlay.style.display = 'none';
                document.body.classList.remove('pdf-mode');
            }
        }
    <\/script>
</body>
</html>`;
}
