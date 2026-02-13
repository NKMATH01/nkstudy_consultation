import { SURVEY_QUESTIONS, FACTOR_LABELS } from "@/types";
import type { Survey, Analysis } from "@/types";
import { env } from "@/lib/env";

// 보안: API 키를 URL 쿼리 파라미터 대신 헤더로 전달하여 로그 노출 방지
function getGeminiUrl() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`;
}

function getApiKey() {
  return env.GEMINI_API_KEY;
}

// ========== Gemini API 호출 ==========
export async function callGeminiAPI(prompt: string, retryCount = 0): Promise<string> {
  const maxRetries = 3;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  };

  const res = await fetch(getGeminiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": getApiKey(), // 보안: URL 쿼리 대신 헤더로 API 키 전달
    },
    body: JSON.stringify(payload),
  });

  if ((res.status === 429 || res.status >= 500) && retryCount < maxRetries) {
    await new Promise((r) => setTimeout(r, 2000 * (retryCount + 1)));
    return callGeminiAPI(prompt, retryCount + 1);
  }

  if (!res.ok) {
    const text = await res.text();
    // TODO: Sentry 등 외부 로깅 서비스로 교체 가능
    console.error("[Gemini API] 호출 실패:", { status: res.status, body: text.substring(0, 200) });
    throw new Error(`Gemini API 오류: ${res.status} - ${text.substring(0, 200)}`);
  }

  const result = await res.json();

  if (
    result.candidates?.[0]?.content?.parts?.[0]?.text
  ) {
    return result.candidates[0].content.parts[0].text;
  }

  if (result.candidates?.[0]?.finishReason === "SAFETY") {
    throw new Error("Gemini 안전 필터에 의해 차단됨");
  }

  throw new Error("Gemini 응답 형식 오류");
}

// ========== JSON 추출 ==========
function cleanJsonString(str: string): string {
  return str
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]")
    .replace(/[\r\n]+/g, " ")
    .replace(/\t/g, " ")
    .trim();
}

export function extractJSON<T = Record<string, unknown>>(text: string): T {
  // 1. ```json ... ``` 블록
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    return JSON.parse(cleanJsonString(jsonMatch[1]));
  }

  // 2. ``` ... ``` 블록
  const codeMatch = text.match(/```\s*([\s\S]*?)\s*```/);
  if (codeMatch && codeMatch[1].trim().startsWith("{")) {
    return JSON.parse(cleanJsonString(codeMatch[1]));
  }

  // 3. 직접 {} 매칭
  const startIdx = text.indexOf("{");
  if (startIdx !== -1) {
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = startIdx; i < text.length; i++) {
      const char = text[i];
      if (escapeNext) { escapeNext = false; continue; }
      if (char === "\\" && inString) { escapeNext = true; continue; }
      if (char === '"') { inString = !inString; continue; }
      if (!inString) {
        if (char === "{") depth++;
        else if (char === "}") {
          depth--;
          if (depth === 0) {
            return JSON.parse(cleanJsonString(text.substring(startIdx, i + 1)));
          }
        }
      }
    }
  }

  throw new Error("JSON을 찾을 수 없음");
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

// ========== 분석 프롬프트 ==========
export function buildAnalysisPrompt(surveyText: string): string {
  return `당신은 대한민국 상위 1% 입시 컨설턴트입니다.
아래 학생 설문조사 데이터를 분석하여 JSON 형식으로 결과를 반환하세요.

[분석 기준 - 6가지 지표 (5점 만점)]
1. 수업태도: 문항 6~10 기반 (집중력, 필기, 졸음, 지각, 이해도)
2. 자기주도성: 문항 11,14,15,18,19 기반 (혼자 공부, 계획 수립, 문제 해결 끈기)
3. 과제수행력: 문항 12,13,16,17 기반 (숙제 완성도, 제출 기한)
4. 학업의지: 문항 21~25 기반 (성적 향상 욕구, 포기하지 않는 마음)
5. 사회성: 문항 1,2,4,5 기반 (성격 적극성, 친구 관계, 적응력)
6. 관리선호: 문항 3,20,28,30 기반 (상담 선호, 강제적 관리 선호)

[분석 지침]
- 모순되는 답변(예: 공부 열심히 하고 싶다 + 숙제 싫다)을 찾아 심리적 갭으로 분석
- "문제점 없다"는 답변은 메타인지 부재로 진단
- 구체적 행동 지침 제시 (레벨 테스트, 플래너 의무화 등)
- 어조: "~하겠습니다" (학원의 주도적 의지)
- 냉철하고 전문적인 분석 제공

[학생 설문 데이터]
${surveyText}

[출력 형식 - 반드시 아래 JSON 구조로만 반환하세요. 다른 텍스트 없이 JSON만 출력]
{
  "studentType": "학생 유형 (예: 잠재적 수동형, 자기주도형, 관리필요형 등)",
  "scores": {
    "attitude": 4.2,
    "selfDirected": 3.2,
    "assignment": 3.5,
    "willingness": 3.4,
    "social": 3.8,
    "management": 4.0
  },
  "scoreComments": {
    "attitude": "점수에 대한 한 줄 코멘트",
    "selfDirected": "점수에 대한 한 줄 코멘트",
    "assignment": "점수에 대한 한 줄 코멘트",
    "willingness": "점수에 대한 한 줄 코멘트",
    "social": "점수에 대한 한 줄 코멘트",
    "management": "점수에 대한 한 줄 코멘트"
  },
  "summary": "종합 요약 텍스트 (3~4문장, 핵심 특성과 개선점 포함)",
  "strengths": [
    {"title": "강점 제목 1", "description": "상세 설명 (2~3문장)"},
    {"title": "강점 제목 2", "description": "상세 설명 (2~3문장)"},
    {"title": "강점 제목 3", "description": "상세 설명 (2~3문장)"}
  ],
  "weaknesses": [
    {"title": "약점 제목 1", "description": "상세 설명 (2~3문장)"},
    {"title": "약점 제목 2", "description": "상세 설명 (2~3문장)"},
    {"title": "약점 제목 3", "description": "상세 설명 (2~3문장)"}
  ],
  "paradox": [
    {
      "title": "심리 갭 제목 1",
      "description": "모순 분석 설명 (2~3문장)",
      "label1": "지표1 이름",
      "value1": 4.0,
      "label2": "지표2 이름",
      "value2": 2.0
    },
    {
      "title": "심리 갭 제목 2",
      "description": "모순 분석 설명 (2~3문장)",
      "studentView": "학생이 생각하는 수준",
      "nkView": "NK 진단 결과"
    }
  ],
  "solutions": [
    {
      "step": 1,
      "weeks": "1~4주차",
      "goal": "단계 목표",
      "actions": ["구체적 행동 1", "구체적 행동 2"]
    },
    {
      "step": 2,
      "weeks": "5~8주차",
      "goal": "단계 목표",
      "actions": ["구체적 행동 1", "구체적 행동 2"]
    },
    {
      "step": 3,
      "weeks": "9~12주차",
      "goal": "단계 목표",
      "actions": ["구체적 행동 1", "구체적 행동 2"]
    }
  ],
  "finalAssessment": "종합 의견 텍스트 (4~5문장, 학원의 관리 방향과 기대 효과)"
}`;
}

// ========== 등록 안내문 프롬프트 ==========
export interface AdminData {
  registrationDate: string;
  assignedClass: string;
  teacher: string;
  useVehicle: string;
  testScore: string;
  testNote: string;
  location: string;
  consultDate: string;
  additionalNote: string;
  tuitionFee: number;
}

export function buildRegistrationPrompt(
  surveyText: string,
  analysis: Analysis,
  adminData: AdminData
): string {
  return `당신은 'NK EDUCATION'의 입시 분석 전문가이자 수석 행정 관리자입니다.
학생의 설문조사 데이터와 AI 분석 결과, 행정 정보를 결합하여 신입생 등록 보고서 내용을 생성하세요.

[NK EDUCATION 학원 정보]
- 수업료: 초4~5: 30만원 / 초6~중1: 32만원 / 중2~3: 35만원 / 고1: 38만원 / 고2: 40만원 (교재비 별도)
- 차량비: 월 ${env.NK_ACADEMY_VEHICLE_FEE || "2만원"}
- 계좌: ${env.NK_ACADEMY_BANK_INFO || "신한은행 110-383-883419"} (예금주: ${env.NK_ACADEMY_BANK_OWNER || "노윤희"})
- 환불: 교육청 교습비 반환 기준 준수 / 2주 이상 미납 시 수업 제한

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
- 배정반: ${adminData.assignedClass}
- 담임: ${adminData.teacher}
- 차량 이용: ${adminData.useVehicle || "미사용"}
- 테스트 점수: ${adminData.testScore || "미입력"}
- 테스트 특이사항: ${adminData.testNote || "없음"}
- 수업 장소: ${adminData.location || "미정"}
- 학부모 상담 예정일: ${adminData.consultDate || "미정"}
- 추가 조치사항: ${adminData.additionalNote || "없음"}

[출력 형식 - 반드시 아래 JSON 구조로만 반환하세요]
{
  "page1": {
    "profileSummary": "진단 결과 요약 텍스트 (테스트 점수 기반, 학생 특성 포함)",
    "tendencyAnalysis": [
      {"title": "학습 의지 및 과제 성실도", "score": 5.0, "color": "indigo", "comment": "설명 (2문장)"},
      {"title": "수학적 구조화 및 필기", "score": 3.0, "color": "red", "comment": "설명 (2문장)"},
      {"title": "문제 해결 끈기 및 집요함", "score": 3.0, "color": "orange", "comment": "설명 (2문장)"},
      {"title": "수업 적응 및 수용 태도", "score": 3.5, "color": "emerald", "comment": "설명 (2문장)"}
    ],
    "managementGuide": [
      {"title": "가이드 제목 1", "description": "상세 설명 (2~3문장)"},
      {"title": "가이드 제목 2", "description": "상세 설명 (2~3문장)"},
      {"title": "가이드 제목 3", "description": "상세 설명 (2~3문장)"}
    ],
    "actionChecklist": [
      "체크리스트 항목 1",
      "체크리스트 항목 2",
      "체크리스트 항목 3",
      "체크리스트 항목 4"
    ]
  },
  "page2": {
    "welcomeMessage": "환영 메시지 (학생 특성 반영, 2~3문장)",
    "expertDiagnosis": "전문가 진단 종합 의견 (3~4문장)",
    "focusPoints": [
      {"number": "01", "title": "포인트 제목 1", "description": "상세 설명 (2문장)"},
      {"number": "02", "title": "포인트 제목 2", "description": "상세 설명 (2문장)"}
    ]
  }
}`;
}
