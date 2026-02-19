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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60초 타임아웃

  const res = await fetch(getGeminiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": getApiKey(), // 보안: URL 쿼리 대신 헤더로 API 키 전달
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

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

// ========== 분석 프롬프트 ==========
export function buildAnalysisPrompt(surveyText: string): string {
  return `당신은 15년 경력의 학습 심리 전문가이자 입시 컨설턴트입니다.
아래 학생 설문조사 데이터를 심리·행동학적 관점에서 심층 분석하여 JSON 형식으로 결과를 반환하세요.

[설문 문항 심리학적 해석 가이드 - 각 문항이 측정하는 심리 요인]

■ 사회성 영역 (문항 1,2,4,5) — 대인관계 성향 및 환경 적응력
- Q1 "적극적이고 활발한 성격이다": 외향성(Extraversion) 자기 인식. 학습 환경에서의 능동성과 참여도를 예측하는 핵심 지표
- Q2 "새로운 환경에 금방 적응한다": 적응 탄력성(Resilience). 학원 전환 시 적응 속도와 정서적 안정성을 나타냄
- Q4 "친구가 많은 학원이 좋다": 소속 욕구(Need for Belonging). 높으면 또래 관계가 학습 동기에 큰 영향을 미치는 유형
- Q5 "친구 관계와 학업의 균형을 잘 맞출 수 있다": 자기 조절(Self-Regulation) 인식. 실제 성적과 비교하면 메타인지 수준을 파악할 수 있음

■ 수업태도 영역 (문항 6,7,8,9,10) — 학습 몰입도 및 수업 적응력
- Q6 "수업에 집중을 잘 듣는 편이다": 주의 지속(Sustained Attention). 집중력 자체에 대한 자기 평가
- Q7 "핵심내용 놓치지 않기 위해 필기하며 수업을 듣는다": 능동적 학습 전략(Active Learning). 정보 처리의 깊이를 보여주는 행동 지표
- Q8 "수업 시간에 절대 졸지 않는다": 각성 수준(Arousal Level) 및 수면 관리. '절대'라는 극단적 표현에 주목 — 5점이면 과장 가능성, 1~2점이면 수면 습관/체력 문제
- Q9 "수업 시간에 지각하지 않는다": 시간 관리(Time Management) 및 규칙 순응도. 낮은 점수는 생활 관리 전반의 문제를 시사
- Q10 "이해도가 빠른 편이다": 인지적 자기 효능감(Cognitive Self-Efficacy). 실제 학업 성취도와 비교 분석 필요

■ 자기주도성 영역 (문항 11,14,15,18,19) — 독립적 학습 능력 및 문제 해결 태도
- Q11 "스스로 공부하는 시간이 많다(숙제 제외)": 내재적 동기(Intrinsic Motivation)의 핵심 지표. 숙제 외 자발적 학습 여부
- Q14 "스스로 계획을 세워서 공부한다": 메타인지적 계획(Metacognitive Planning). 학습 전략 수립 능력
- Q15 "공간에 상관없이 열심히 공부한다": 환경 독립성(Context Independence). 높으면 자기 통제력이 강한 유형
- Q18 "모르는 문제는 스스로 많은 고민을 하고 푼다": 인지적 끈기(Cognitive Persistence). 어려움 앞에서의 대처 전략
- Q19 "스스로 10분 정도 고민한 후 다른 풀이를 참고한다": 적절한 도움 요청(Help-Seeking). Q18과 함께 보면 문제 해결 전략의 성숙도를 알 수 있음. Q18은 높고 Q19가 낮으면 고집형, 둘 다 낮으면 즉시 포기형

■ 과제수행력 영역 (문항 12,13,16,17) — 과제 완수 습관 및 성실성
- Q12 "숙제를 열심히 한다": 과제 성실성(Task Conscientiousness). 기본적인 학습 책임감
- Q13 "예습과 복습 모두 중요하게 생각한다": 학습 인식(Learning Awareness). '생각한다'는 태도이므로 실제 행동(Q11, Q12)과 괴리가 있는지 반드시 교차 확인
- Q16 "숙제를 반드시 정해진 시간에 제출한다": 기한 준수(Deadline Compliance). 자기 관리 능력의 실질적 행동 지표
- Q17 "숙제를 꼼꼼하고 정성껏 하는 편이다": 과제 품질(Task Quality). Q12와 함께 보면 '하긴 하는데 대충 하는지' vs '정성껏 하는지' 구분 가능

■ 학업의지 영역 (문항 21,22,23,24,25) — 학습 동기 수준 및 목표 지향성
- Q21 "NK학원에 꼭 다니고 싶다": 외적 동기(Extrinsic Motivation) 및 학원에 대한 기대감. 낮으면 비자발적 등록 가능성
- Q22 "힘들어도 공부를 시켜주는 학원을 가고 싶다": 고통 감수 의지(Pain Tolerance for Growth). 높으면 관리형 교육에 적합
- Q23 "어려워도 쉽게 포기하지 않는다": 끈기(Grit). 장기적 학습 성과의 가장 강력한 예측 변인
- Q24 "꼭 공부를 잘하고 싶다": 성취 욕구(Achievement Motivation). 추상적 바람이므로 Q11, Q14 등 실제 행동과 교차 분석 필수
- Q25 "진짜 공부를 열심히 해 볼 생각이다": 행동 의도(Behavioral Intention). '생각이다'라는 표현은 아직 실천이 아닌 계획 단계. Q24와 함께 5점인데 Q11~Q17이 낮으면 전형적인 '의지-실천 괴리' 패턴

■ 관리선호 영역 (문항 3,20,28,30) — 학습 관리 방식 선호도 및 의존성
- Q3 "상담을 자주 해줬으면 좋겠다": 정서적 지지 욕구(Emotional Support Need). 높으면 관계 중심 학습자
- Q20 "숙제가 많은 것이 좋다": 구조화 선호(Structure Preference). 높으면 외부 과제 부여가 효과적인 유형. 낮으면 자율성 욕구가 높거나 학업 회피 성향
- Q28 "상담을 많이 해주는 선생님이 좋다": Q3과 교차 확인. 둘 다 높으면 정서적 지지가 학습 동기에 직접 영향
- Q30 "강제적으로 공부하게 만드는 선생님이 좋다": 외적 통제 선호(External Control Preference). 자기 조절 능력이 부족한 학생이 높은 경향. Q14(계획수립)가 낮고 Q30이 높으면 전형적인 '타율형 학습자'

■ 심리·자신감 영역 (문항 26,27,31,32,33) — 시험 불안, 정서적 회복력, 과목별 자기효능감
- Q26 "시험을 볼 때 긴장하지 않고 실력을 잘 발휘한다": 시험 자신감(Test Confidence). 낮으면 시험 불안(Test Anxiety)이 높은 유형. 실력은 있으나 시험에서 발휘 못하는 패턴
- Q27 "선생님이 엄하게 지도해도 의욕이 떨어지지 않는다": 정서적 회복력(Emotional Resilience). 낮으면 비판에 민감한 유형으로 격려 중심 지도가 필요
- Q31 "수학을 잘할 수 있다고 생각한다": 수학 자기효능감(Math Self-Efficacy). 수학 학원에서 가장 중요한 심리 지표. Q32(영어)와 비교하면 과목별 자신감 불균형 파악 가능
- Q32 "영어를 잘할 수 있다고 생각한다": 영어 자기효능감(English Self-Efficacy). Q31과의 차이가 크면 과목 간 학습 동기 불균형
- Q33 "아는 문제를 시험에서 실수 없이 잘 푸는 편이다": 시험 수행 안정성(Performance Stability). Q26과 함께 보면 시험 불안의 실제 영향도를 파악. Q26은 낮은데 Q33도 낮으면 시험 불안이 실제 성적에 영향을 미치는 심각한 수준

■ 자기주도성 추가 문항
- Q29 "공부할 때 핸드폰을 멀리 두는 편이다": 디지털 자기통제(Digital Self-Control). 현대 학생의 가장 큰 학습 방해 요인. 낮으면 집중력 문제의 핵심 원인일 수 있음. Q6(수업집중)과 교차 분석 필요

■ 과제수행력 추가 문항 (영어+수학 학원 특화)
- Q34 "영어 단어를 꾸준히 외우는 편이다": 영어 학습 성실성. 반복 암기에 대한 인내력과 꾸준함 측정. Q12(숙제 열심히)와 교차하면 과목별 학습 태도 차이 확인
- Q35 "수학 공식이나 풀이 과정을 정리하는 편이다": 수학 학습 체계성. 수학적 사고의 정리 습관. Q17(꼼꼼한 숙제)과 교차하면 학습 정리력의 일관성 확인

[교차 분석 패턴 — 반드시 확인하고 해당되면 분석에 반영]
1. 의지-실천 괴리: Q24,Q25(의지)는 높은데 Q11,Q14,Q16(실천)이 낮으면 → "마음은 있지만 실행력이 부족한 유형"
2. 자기 과대평가: Q10(이해도 빠름)이 높은데 Q12,Q16,Q17(과제)가 낮으면 → "이해했다고 착각하지만 실제 정착이 안 되는 유형"
3. 수동적 학습자: Q30(강제관리)과 Q20(숙제많은것)이 높은데 Q11(자율학습), Q14(계획)가 낮으면 → "스스로 움직이지 않고 외부 관리에 의존하는 유형"
4. 사회성 vs 학업 균형: Q4(친구많은학원)가 높은데 Q5(균형)가 낮으면 → "또래 관계에 치우쳐 학업에 소홀할 위험"
5. 태도-행동 불일치: Q13(예복습 중요하게 생각)은 높은데 Q11(자율학습)이 낮으면 → "중요하다는 건 알지만 행동으로 옮기지 못하는 유형"
6. 포기 패턴: Q18(고민하고 풀기)과 Q23(포기안함)이 낮으면 → "어려움 회피 성향, 도전 과제에서 쉽게 좌절"
7. 메타인지 부재: 주관식에서 "문제점 없다"/"좋아요"/"없음" 등 구체적 응답이 없으면 → 자기 성찰 능력 부족으로 진단
8. 기존 학원 불만 패턴: prev_complaint 내용과 현재 설문 응답을 교차 분석. 예) "관리 부족" 불만인데 Q30(강제관리)이 높으면 타율형 확인
9. 시험 불안-실력 괴리: Q26(시험자신감)과 Q33(실수없이 풀기)이 모두 낮은데 Q10(이해도)이 높으면 → "실력은 있으나 시험 상황에서 발휘 못하는 유형"
10. 과목별 자신감 불균형: Q31(수학자신감)과 Q32(영어자신감)의 차이가 2점 이상이면 → "특정 과목에 대한 심리적 장벽이 있는 유형. 약한 과목부터 성공 경험 쌓기 필요"
11. 영어수학 학습 습관 차이: Q34(영어단어)와 Q35(수학정리)의 차이가 크면 → "과목별 학습 방법론의 편차가 큰 유형"
12. 디지털 방해-집중력 연계: Q29(핸드폰 멀리두기)가 낮으면서 Q6(수업집중)도 낮으면 → "디지털 기기가 학습 집중에 직접적 영향을 미치는 유형"
13. 정서적 민감도: Q27(엄한지도 견딤)이 낮으면서 Q22(힘들어도 학원)가 높으면 → "학습 의지는 있으나 방식에 민감한 유형. 격려형 지도 필요"

[문체 규칙 - 매우 중요]
- 학부모에게 직접 설명하듯 따뜻하면서도 전문적인 톤으로 작성
- "~합니다", "~일 것으로 보입니다", "~하는 경향이 있습니다" 등 정중한 존댓말 사용
- "~것으로 판단됩니다", "~것으로 분석됩니다", "~것으로 사료됩니다" 같은 딱딱한 AI 문체 절대 금지
- "~해주셨습니다", "~보여주셨습니다", "~답변해주셨습니다" 같은 극존칭 절대 금지. 학생에게 존칭 쓰지 말 것
- 올바른 예: "4점으로 답변했습니다", "높은 점수를 보입니다", "긍정적으로 응답했습니다"
- 잘못된 예: "4점으로 답변해주셨습니다", "높은 점수를 보여주셨습니다"
- "~하는 모습이 보입니다", "~하는 편입니다", "~일 것으로 보입니다" 처럼 자연스러운 말투 사용
- 한 문장이 너무 길지 않게, 읽기 쉽게 끊어서 작성
- 구체적인 문항 번호와 점수를 인용하며 근거 기반으로 분석 (예: "Q11에서 2점으로 응답한 점을 보면~")

[학생 설문 데이터]
${surveyText}

[출력 형식 - 반드시 아래 JSON 구조로만 반환하세요. 다른 텍스트 없이 JSON만 출력]
{
  "studentType": "학생 유형을 심리학적 용어로 명명 (예: 의지-실천 괴리형, 타율적 잠재력형, 자기주도 성장형, 수동적 회피형, 외부의존 관리필요형 등)",
  "scores": {
    "attitude": 4.2,
    "selfDirected": 3.2,
    "assignment": 3.5,
    "willingness": 3.4,
    "social": 3.8,
    "management": 4.0,
    "emotion": 3.6
  },
  "scoreComments": {
    "attitude": "3~4문장. Q6~Q10 각 문항의 점수를 구체적으로 인용하며 분석. 예: 'Q6(집중) 4점, Q7(필기) 3점으로 수업 참여도는 양호하지만, Q8(졸음) 2점은 수면 관리나 체력 문제가 있을 수 있습니다.'",
    "selfDirected": "3~4문장. Q11,Q14,Q15,Q18,Q19,Q29 각 점수를 인용. 특히 Q18-Q19 조합으로 문제 해결 전략 유형 분석. Q29(핸드폰) 점수로 디지털 자기통제 수준 평가",
    "assignment": "3~4문장. Q12,Q13,Q16,Q17,Q34,Q35 각 점수를 인용. Q13(인식)과 Q12,Q16(행동)의 괴리 여부 분석. Q34(영어단어)와 Q35(수학정리)로 과목별 학습 습관 차이 분석",
    "willingness": "3~4문장. Q21~Q25 각 점수를 인용. 의지 점수와 실천 영역(자기주도성, 과제수행력) 점수의 차이를 교차 분석",
    "social": "3~4문장. Q1,Q2,Q4,Q5 각 점수를 인용. 외향성 수준과 학업-사회 균형 능력 분석",
    "management": "3~4문장. Q3,Q20,Q28,Q30 각 점수를 인용. 자기주도성 점수와 비교하여 타율형/자율형 학습자 판별",
    "emotion": "3~4문장. Q26,Q27,Q31,Q32,Q33 각 점수를 인용. Q26(시험자신감)과 Q33(실수없이풀기)으로 시험 불안 수준 진단. Q31(수학자신감)과 Q32(영어자신감) 비교로 과목별 심리적 장벽 분석. Q27(엄한지도 견딤)으로 정서적 회복력 평가"
  },
  "summary": "6~8문장. 학생의 핵심 심리 성향과 학습 스타일을 종합 정리. NK 학원이 어떻게 하겠다가 아니라, 이 학생이 어떤 심리적 특성을 가진 아이인지 학부모가 깊이 이해할 수 있도록 서술. 교차 분석 패턴 중 해당되는 것을 반드시 언급. 주관식 응답 내용도 반영",
  "strengths": [
    {"title": "강점 제목 1", "description": "3~4문장. 구체적 문항 번호와 점수를 근거로 제시. 이 강점이 학습에서 어떤 긍정적 영향을 미치는지 심리학적 맥락에서 설명"},
    {"title": "강점 제목 2", "description": "3~4문장"},
    {"title": "강점 제목 3", "description": "3~4문장"}
  ],
  "weaknesses": [
    {"title": "약점 제목 1", "description": "3~4문장. 구체적 문항 번호와 점수를 근거로 제시. 교차 분석 패턴을 활용하여 표면적 약점이 아닌 근본 원인을 짚어서 설명"},
    {"title": "약점 제목 2", "description": "3~4문장"},
    {"title": "약점 제목 3", "description": "3~4문장"}
  ],
  "paradox": [
    {
      "title": "심리적 간극을 명확히 드러내는 제목 (예: '의지는 5점, 실행은 2점 — 마음과 행동의 괴리')",
      "description": "2~3문장. 어떤 문항끼리 모순되는지 구체적 점수와 함께 설명. 이 괴리가 학습에서 어떤 문제로 나타나는지 서술",
      "label1": "높은 쪽 지표명",
      "value1": 4.5,
      "label2": "낮은 쪽 지표명",
      "value2": 2.0
    },
    {
      "title": "두 번째 심리적 간극 제목",
      "description": "2~3문장. 기존 학원 불만사항, 주관식 응답과 실제 설문 점수의 모순도 분석",
      "label1": "학생 자기 인식",
      "value1": 4.0,
      "label2": "실제 행동 점수",
      "value2": 2.0
    }
  ],
  "solutions": [
    {
      "step": 1,
      "weeks": "1~4주차",
      "goal": "이 학생의 핵심 약점에 맞춘 구체적 목표",
      "actions": ["학생 성향에 맞는 구체적 행동 지침 1 (예: 매일 플래너 작성 후 담임 확인)", "구체적 행동 지침 2"]
    },
    {
      "step": 2,
      "weeks": "5~8주차",
      "goal": "단계적 성장 목표",
      "actions": ["구체적 행동 지침", "구체적 행동 지침"]
    },
    {
      "step": 3,
      "weeks": "9~12주차",
      "goal": "자립 목표",
      "actions": ["구체적 행동 지침", "구체적 행동 지침"]
    }
  ],
  "finalAssessment": "6~8문장. 학생의 심리 성향에 맞춘 NK의 구체적 지도 방향. 이 학생에게 맞는 수업 방식(자율형/관리형/병행형), 담임과의 소통 빈도, 과제 관리 강도, 정서적 지원 방식 등을 구체적으로 제시. 학부모에게 안심을 주는 톤으로 작성"
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
심리·자신감: ${analysis.score_emotion ?? "N/A"}점
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
