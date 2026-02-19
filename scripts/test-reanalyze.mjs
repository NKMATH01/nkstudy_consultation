import { createClient } from "@supabase/supabase-js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SURVEY_QUESTIONS = [
  "나는 적극적인 성격이다",
  "새로운 환경에 잘 적응하는 편이다",
  "부모님이나 선생님의 말씀을 잘 따르는 편이다",
  "학교에서 친구들과 잘 어울린다",
  "모르는 사람에게 먼저 말을 걸 수 있다",
  "수업 시간에 집중을 잘 하는 편이다",
  "수업 중 필기를 잘 하는 편이다",
  "수업 시간에 졸지 않는다",
  "수업에 지각하지 않는다",
  "선생님 설명을 빠르게 이해하는 편이다",
  "혼자 공부하는 시간이 많다",
  "숙제를 꼼꼼히 하는 편이다",
  "숙제를 제때 제출한다",
  "스스로 학습 계획을 세워 공부한다",
  "문제를 끝까지 풀려고 노력한다",
  "틀린 문제를 다시 풀어본다",
  "시험 전에 계획적으로 공부한다",
  "예습과 복습을 중요하게 생각한다",
  "모르는 것은 선생님께 질문한다",
  "공부할 때 누군가 봐주는 게 좋다",
  "성적을 올리고 싶은 마음이 크다",
  "수학이 중요하다고 생각한다",
  "수학 공부를 열심히 하고 싶다",
  "어려운 문제도 포기하지 않으려 한다",
  "미래 목표를 위해 공부가 필요하다고 생각한다",
  "나는 시험을 볼 때 긴장하지 않고 실력을 잘 발휘한다",
  "나는 선생님이 엄하게 지도해도 의욕이 떨어지지 않는다",
  "학원 상담이 도움이 된다고 생각한다",
  "나는 공부할 때 핸드폰을 멀리 두는 편이다",
  "강제적으로라도 관리해줬으면 좋겠다",
  "나는 수학을 잘할 수 있다고 생각한다",
  "나는 영어를 잘할 수 있다고 생각한다",
  "나는 아는 문제를 시험에서 실수 없이 잘 푸는 편이다",
  "나는 영어 단어를 꾸준히 외우는 편이다",
  "나는 수학 공식이나 풀이 과정을 정리하는 편이다",
];

const FACTOR_LABELS = {
  attitude: "수업태도",
  self_directed: "자기주도성",
  assignment: "과제수행력",
  willingness: "학업의지",
  social: "사회성",
  management: "관리선호도",
  emotion: "심리·자신감",
};

function surveyToText(survey) {
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
    const score = survey[`q${qNum}`];
    text += `${qNum}. ${SURVEY_QUESTIONS[i]}: ${score ?? "미응답"}\n`;
  }
  text += "\n=== 7-Factor 평균 점수 ===\n";
  for (const key of ["attitude", "self_directed", "assignment", "willingness", "social", "management", "emotion"]) {
    const val = survey[`factor_${key}`];
    text += `${FACTOR_LABELS[key]}: ${val != null ? val.toFixed(1) : "N/A"}\n`;
  }
  text += "\n=== 주관식 ===\n";
  text += `공부의 핵심: ${survey.study_core || ""}\n`;
  text += `본인의 학습 문제점: ${survey.problem_self || ""}\n`;
  text += `희망 직업: ${survey.dream || ""}\n`;
  text += `선호 요일: ${survey.prefer_days || ""}\n`;
  text += `NK학원에 바라는 점: ${survey.requests || ""}\n`;
  text += `수학 어려운 영역: ${survey.math_difficulty || ""}\n`;
  text += `영어 어려운 영역: ${survey.english_difficulty || ""}\n`;
  return text;
}

// 프롬프트를 gemini.ts에서 런타임에 읽어서 사용
import { readFileSync } from "fs";
function buildPrompt(surveyText) {
  const src = readFileSync(resolve(__dirname, "../src/lib/gemini.ts"), "utf-8");
  // buildAnalysisPrompt 함수 내의 템플릿 리터럴 추출
  const match = src.match(/export function buildAnalysisPrompt[\s\S]*?return `([\s\S]*?)`;\s*\}/);
  if (!match) throw new Error("gemini.ts에서 프롬프트를 찾을 수 없습니다");
  const template = match[1];
  // ${surveyText} 치환
  return template.replace("${surveyText}", surveyText);
}

const SURVEY_ID = "2a8c3ba2-bf68-456e-bada-2e75259072b0"; // 김기영

console.log("1. 설문 데이터 조회...");
const { data: survey, error } = await sb.from("surveys").select("*").eq("id", SURVEY_ID).single();
if (error) { console.error("설문 조회 실패:", error); process.exit(1); }
console.log(`   > ${survey.name} ${survey.school} ${survey.grade}`);

console.log("2. Gemini API 호출...");
const surveyText = surveyToText(survey);
const prompt = buildPrompt(surveyText);

const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || "gemini-2.0-flash"}:generateContent`;
const res = await fetch(geminiUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, topP: 0.95, maxOutputTokens: 8192 },
  }),
});

if (!res.ok) { console.error("Gemini 실패:", res.status, await res.text()); process.exit(1); }

const result = await res.json();
const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
if (!rawText) { console.error("Gemini 응답 없음"); process.exit(1); }

// Extract JSON
let jsonStr = rawText;
const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
if (jsonMatch) jsonStr = jsonMatch[1];
else {
  const codeMatch = rawText.match(/```\s*([\s\S]*?)\s*```/);
  if (codeMatch && codeMatch[1].trim().startsWith("{")) jsonStr = codeMatch[1];
  else {
    const idx = rawText.indexOf("{");
    if (idx >= 0) jsonStr = rawText.substring(idx);
  }
}

const analysisResult = JSON.parse(jsonStr.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]"));
console.log(`   > 학생유형: ${analysisResult.studentType}`);

console.log("\n=== paradox 확인 ===");
for (const p of analysisResult.paradox || []) {
  console.log(`  ${p.title} | ${p.label1}=${p.value1} vs ${p.label2}=${p.value2}`);
}

console.log("\n=== scores (7-Factor) ===");
console.log(JSON.stringify(analysisResult.scores, null, 2));

console.log("\n=== 문체 확인 (comment_attitude) ===");
console.log(analysisResult.scoreComments.attitude);

console.log("\n=== comment_emotion (심리·자신감) ===");
console.log(analysisResult.scoreComments.emotion || "(없음)");

console.log("\n=== summary ===");
console.log(analysisResult.summary);

console.log("\n=== finalAssessment ===");
console.log(analysisResult.finalAssessment);

// Save to DB
console.log("\n3. DB 저장...");
const insertData = {
  survey_id: SURVEY_ID,
  name: survey.name,
  school: survey.school,
  grade: survey.grade,
  score_attitude: analysisResult.scores.attitude,
  score_self_directed: analysisResult.scores.selfDirected,
  score_assignment: analysisResult.scores.assignment,
  score_willingness: analysisResult.scores.willingness,
  score_social: analysisResult.scores.social,
  score_management: analysisResult.scores.management,
  score_emotion: analysisResult.scores.emotion ?? null,
  comment_attitude: analysisResult.scoreComments.attitude,
  comment_self_directed: analysisResult.scoreComments.selfDirected,
  comment_assignment: analysisResult.scoreComments.assignment,
  comment_willingness: analysisResult.scoreComments.willingness,
  comment_social: analysisResult.scoreComments.social,
  comment_management: analysisResult.scoreComments.management,
  comment_emotion: analysisResult.scoreComments.emotion ?? null,
  student_type: analysisResult.studentType,
  summary: analysisResult.summary,
  strengths: analysisResult.strengths,
  weaknesses: analysisResult.weaknesses,
  paradox: analysisResult.paradox,
  solutions: analysisResult.solutions,
  final_assessment: analysisResult.finalAssessment,
  report_html: null,
};

const { data: saved, error: saveErr } = await sb.from("analyses").insert(insertData).select().single();
if (saveErr) { console.error("저장 실패:", saveErr); process.exit(1); }
console.log(`   > 저장 완료! ID: ${saved.id}`);
console.log("\n완료!");
