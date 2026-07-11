// 학생 실명 호칭 치환 (§11 보안 유지).
// AI에는 학생 이름을 전송하지 않는다. 대신 AI는 학생을 지칭할 때 문자 그대로 "{{학생}}" 토큰만 쓰고,
// 서버가 AI 응답 수신 후(또는 렌더 직전) 실제 이름 + "학생"(예: "강현찬 학생")으로 로컬 치환한다.
// AI가 지시를 어기고 "따님/아드님/자녀/아이"를 쓴 경우도 같은 규칙으로 보수적으로 교정한다.
//   - 오탐 방지: "아이디어·아이돌·아이콘·아이템·아이패드·아이폰·아이스"처럼 뒤 음절이 조사가 아닌
//     합성어와, 앞에 한글이 붙은 "어린아이" 같은 합성어는 건드리지 않는다(단어 경계 확인).
//   - 모음 종결 호칭(아이/자녀)은 자음 종결 "학생"에 맞게 조사도 함께 교정한다(예: "아이가" → "OO 학생이").

import type { AiInterpretation } from "./ai-contract";

/** AI가 학생을 지칭할 때 사용해야 하는 리터럴 토큰. */
export const STUDENT_TOKEN = "{{학생}}";

/** 이름 → 표시 호칭. 이름이 없으면 일반 명사 "학생". */
export function studentLabel(name?: string | null): string {
  const n = (name ?? "").trim();
  return n ? `${n} 학생` : "학생";
}

// 자음 종결 호칭(따님·아드님·자제분·자녀분): 뒤 조사가 "학생"과 호환되므로 명사만 교체한다.
const CONSONANT_NOUN = /(?<![가-힣])(?:따님|아드님|자제분|자녀분)/g;
// 모음 종결 호칭(아이·자녀) + 조사: "학생"(자음 종결)에 맞게 조사도 교정한다.
const VOWEL_PARTICLE: Array<[RegExp, string]> = [
  [/(?<![가-힣])(?:아이|자녀)가(?![가-힣])/g, "이"], // 주격
  [/(?<![가-힣])(?:아이|자녀)는(?![가-힣])/g, "은"], // 주제
  [/(?<![가-힣])(?:아이|자녀)를(?![가-힣])/g, "을"], // 목적
  [/(?<![가-힣])(?:아이|자녀)와(?![가-힣])/g, "과"], // 공동
];
// 조사 형태가 그대로 유지되는 경우(의·도·에게·한테·랑·보다·처럼·께·에·만·까지·부터).
const VOWEL_SAME = /(?<![가-힣])(?:아이|자녀)(의|도|에게서|에게|한테|랑|보다|처럼|께|에|만|까지|부터)(?![가-힣])/g;
// 조사 없이 단독으로 쓰인 경우(뒤가 한글이면 합성어이므로 제외).
const VOWEL_BARE = /(?<![가-힣])(?:아이|자녀)(?![가-힣])/g;

/** 한 문자열에서 토큰 치환 + 호칭 교정을 수행한다(멱등). */
export function applyStudentName(text: string, name?: string | null): string {
  const label = studentLabel(name);
  let t = text.split(STUDENT_TOKEN).join(label);
  t = t.replace(CONSONANT_NOUN, label);
  for (const [re, particle] of VOWEL_PARTICLE) t = t.replace(re, `${label}${particle}`);
  t = t.replace(VOWEL_SAME, (_m, p1: string) => `${label}${p1}`);
  t = t.replace(VOWEL_BARE, label);
  return t;
}

const mapArr = (arr: string[], name?: string | null) => arr.map((s) => applyStudentName(s, name));

/** 해석(AI 또는 fallback)의 모든 텍스트 필드에 호칭 치환을 적용한 새 객체를 만든다. */
export function applyStudentNameToInterpretation(
  interp: AiInterpretation,
  name?: string | null
): AiInterpretation {
  const s = (v: string) => applyStudentName(v, name);
  return {
    ...interp,
    studentType: s(interp.studentType),
    detailedSummary: s(interp.detailedSummary),
    coreObservation: s(interp.coreObservation),
    operatingCause: s(interp.operatingCause),
    recommendedCoaching: s(interp.recommendedCoaching),
    verificationPlan14Days: mapArr(interp.verificationPlan14Days, name),
    teacherBrief: mapArr(interp.teacherBrief, name),
    strengths: mapArr(interp.strengths, name),
    growthAreas: mapArr(interp.growthAreas, name),
    crossEvidence: mapArr(interp.crossEvidence, name),
    nkFitInterpretation: s(interp.nkFitInterpretation),
    mathStrategy: interp.mathStrategy ? s(interp.mathStrategy) : interp.mathStrategy,
    englishStrategy: interp.englishStrategy ? s(interp.englishStrategy) : interp.englishStrategy,
    roadmap12Weeks: interp.roadmap12Weeks.map((r) => ({
      ...r,
      focus: s(r.focus),
      actions: mapArr(r.actions, name),
    })),
    parentSummary: s(interp.parentSummary),
    cautions: mapArr(interp.cautions, name),
  };
}
