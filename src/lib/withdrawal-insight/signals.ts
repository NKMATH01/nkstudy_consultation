// 자유서술(학생/학부모/강사 의견·상담 요약·특이사항)에서 원인 주제를 태깅하는 순수 모듈.
//
// reason_category 한 칸만 세면 "성적 부진"류 한 덩어리로 뭉쳐 원인이 보이지 않는다.
// 실제 원문에는 훨씬 구체적인 표현이 남아 있어(숙제 양·합반 적응·윈터스쿨 이동 등)
// 그 표현을 주제로 묶는다. 사전은 운영 DB 원문을 읽고 실제 빈출 표현으로 구성했다.
//
// 한계: 형태소 분석 없이 부분 문자열로 매칭하므로 오탐이 있다. 특히 teaching은
// 사람에 대한 평가로 읽히기 쉬워 보수적으로(불만 문맥 표현만) 잡는다.
// 그래서 이 신호는 "원문을 확인할 사건을 좁히는 용도"이지 판정 결과가 아니다.

import type { Withdrawal } from "@/types";

export type SignalTopic =
  | "engagement"
  | "fit"
  | "performance"
  | "schedule"
  | "alternative"
  | "teaching";

export const SIGNAL_TOPICS: SignalTopic[] = [
  "engagement",
  "fit",
  "performance",
  "schedule",
  "alternative",
  "teaching",
];

export const SIGNAL_LABEL: Record<SignalTopic, string> = {
  engagement: "참여·습관",
  fit: "수준·학습량 적합",
  performance: "성과 체감",
  schedule: "일정·통학",
  alternative: "대안 교육 이동",
  teaching: "수업·소통",
};

export const SIGNAL_GLOSS: Record<SignalTopic, string> = {
  engagement: "숙제·출결·집중·학습 태도에 대한 서술",
  fit: "난이도·학습량·진도·반 적응에 대한 서술",
  performance: "성적·점수 변화와 체감 효과에 대한 서술",
  schedule: "시간표·통학·픽드랍·체력 부담에 대한 서술",
  alternative: "윈터스쿨·인강·과외·타학원 등 다른 선택지로의 이동",
  teaching: "수업 방식·설명·질문·소통에 대한 불만 서술",
};

/** 신호를 읽는 자유서술 필드. reason_detail 컬럼은 존재하지 않아 special_notes로 대체한다. */
export const SIGNAL_SOURCE_FIELDS = [
  "student_opinion",
  "parent_opinion",
  "teacher_opinion",
  "final_consult_summary",
  "special_notes",
] as const;

export type SignalSourceField = (typeof SIGNAL_SOURCE_FIELDS)[number];

export const SOURCE_FIELD_LABEL: Record<SignalSourceField, string> = {
  student_opinion: "학생 의견",
  parent_opinion: "학부모 의견",
  teacher_opinion: "강사 의견",
  final_consult_summary: "상담 요약",
  special_notes: "특이사항",
};

// 실제 원문 빈도를 확인해 구성했다(괄호 안은 149행 전체 등장 횟수 기준 상위 표현).
const KEYWORDS: Record<SignalTopic, string[]> = {
  // 숙제(57)·태도(25)·의지(18)·결석(17)·집중(14)
  engagement: [
    "숙제", "과제", "일일테스트", "일테", "출석", "결석", "지각", "결시",
    "집중", "태도", "의지", "습관", "적극", "성실", "미제출", "안 해",
    "안해오", "밀린", "빼먹", "게으", "동기", "학습량 소화", "자기주도",
  ],
  // 어려(28)·부담(19)·진도(15)·적응(12)·특강(10)·커리큘럼(8)
  fit: [
    "어렵", "어려", "쉬웠", "쉬운", "진도", "학습량", "양이 많", "양이많",
    "부담", "수준", "레벨", "따라가", "합반", "반 변경", "반변경", "적응",
    "커리큘럼", "특강", "난이도", "버거", "벅차", "안 맞", "안맞", "맞지 않",
  ],
  // 성적(41)·점수(21)·하락(8)·결과(8)
  performance: [
    "성적", "점수", "등급", "오르", "떨어", "하락", "효과", "결과", "성과",
    "불만족", "안 나오", "안나오", "나오지 않", "제자리", "향상",
  ],
  // 시간(51)·일정(7)·요일(5)·거리(5)·픽드랍(3)
  schedule: [
    "시간표", "스케줄", "요일", "통학", "거리", "픽드랍", "픽업", "라이드",
    "겹치", "일정", "체력", "늦게 끝", "거리가", "이동 시간", "이동시간",
    "너무 늦", "오래 남",
  ],
  // 윈터스쿨(16)·과외(15)·인강(11)·학원 옮(12)
  alternative: [
    "윈터스쿨", "윈터캠프", "썸머스쿨", "기숙", "인강", "메가스터디", "이투스",
    "대성", "청솔", "과외", "타학원", "다른 학원", "다른학원", "학원 옮",
    "학원옮", "학원 변경", "학원변경", "학원 이동", "학원이동", "옮기",
    "옮겨", "혼자서 공부", "스스로 공부", "독학",
  ],
  // teaching은 오탐이 크다. 불만 문맥이 비교적 분명한 표현만 넣는다.
  // "선생님"(14)·"설명"(7)·"질문"(7) 단독은 중립 서술이 대부분이라 제외한다.
  teaching: [
    "설명이 부족", "설명 부족", "질문하기 어렵", "질문을 못", "질문이 어렵",
    "소통이 안", "소통 부족", "피드백이 없", "피드백 부족", "상담 부족",
    "관리가 안", "관리 부족", "케어가 부족", "케어 부족", "방치",
    "수업이 지루", "지루함", "수업 방식", "수업방식", "불친절",
  ],
};

export interface SignalMatch {
  topic: SignalTopic;
  keyword: string;
  field: SignalSourceField;
  /** 매칭 문장 주변 발췌(원문 확인용). */
  snippet: string;
}

export interface SignalResult {
  topics: SignalTopic[];
  matches: SignalMatch[];
}

const SNIPPET_PAD = 40;

function buildSnippet(text: string, index: number, keywordLength: number): string {
  const start = Math.max(0, index - SNIPPET_PAD);
  const end = Math.min(text.length, index + keywordLength + SNIPPET_PAD);
  const body = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${body}${end < text.length ? "…" : ""}`;
}

/**
 * 한 퇴원 행의 자유서술에서 주제 신호를 뽑는다.
 * 같은 주제가 여러 번 걸려도 topics에는 한 번만 담고, matches에는 근거를 모두 남긴다.
 */
export function detectSignals(row: Withdrawal): SignalResult {
  const matches: SignalMatch[] = [];
  const found = new Set<SignalTopic>();

  for (const field of SIGNAL_SOURCE_FIELDS) {
    const text = (row[field] ?? "").trim();
    if (!text) continue;

    for (const topic of SIGNAL_TOPICS) {
      for (const keyword of KEYWORDS[topic]) {
        const index = text.indexOf(keyword);
        if (index === -1) continue;
        found.add(topic);
        matches.push({
          topic,
          keyword,
          field,
          snippet: buildSnippet(text, index, keyword.length),
        });
        // 같은 필드·같은 주제는 첫 근거 하나면 충분하다(스니펫 폭주 방지).
        break;
      }
    }
  }

  return {
    topics: SIGNAL_TOPICS.filter((topic) => found.has(topic)),
    matches,
  };
}

/**
 * 학부모 의견이 학생 의견의 복사본인지 판정한다.
 * 복사본이면 "학부모의 별도 진술"로 셀 수 없다(근거 출처가 하나로 줄어든다).
 */
export function isParentOpinionCopied(row: Withdrawal): boolean {
  const student = (row.student_opinion ?? "").replace(/\s+/g, "");
  const parent = (row.parent_opinion ?? "").replace(/\s+/g, "");
  if (!student || !parent) return false;
  if (student === parent) return true;
  // 한쪽이 다른 쪽을 통째로 포함하면 사실상 복사로 본다(짧은 문구 오탐 방지로 길이 하한).
  const MIN = 10;
  if (student.length >= MIN && parent.includes(student)) return true;
  if (parent.length >= MIN && student.includes(parent)) return true;
  return false;
}

/** 상담 요약이 사실상 비어 있는지(30자 미만) 판정한다. */
export const SUMMARY_MIN_LENGTH = 30;

export function hasThinSummary(row: Withdrawal): boolean {
  return (row.final_consult_summary ?? "").trim().length < SUMMARY_MIN_LENGTH;
}

/**
 * 떠난 곳 추정. alternative 신호와 사유 텍스트에서 유형만 고른다.
 * 어디까지나 자동 추정이며 화면에도 그렇게 표기한다.
 */
export type DepartureTarget = "academy" | "tutor" | "online" | "rest" | "unknown";

export const DEPARTURE_LABEL: Record<DepartureTarget, string> = {
  academy: "타학원·기숙형",
  tutor: "과외",
  online: "인강·독학",
  rest: "휴식·휴원",
  unknown: "불명",
};

export function estimateDepartureTarget(row: Withdrawal): DepartureTarget {
  const text = SIGNAL_SOURCE_FIELDS.map((f) => row[f] ?? "").join(" ");
  const has = (...words: string[]) => words.some((w) => text.includes(w));

  if (has("윈터스쿨", "윈터캠프", "썸머스쿨", "기숙", "타학원", "다른 학원", "다른학원", "학원 옮", "학원옮", "학원 변경", "학원변경", "학원 이동", "학원이동", "청솔", "이투스", "대성"))
    return "academy";
  if (has("과외")) return "tutor";
  if (has("인강", "메가스터디", "혼자서 공부", "스스로 공부", "독학")) return "online";
  if (has("휴식", "쉬고", "휴원", "쉬기로")) return "rest";
  return "unknown";
}
