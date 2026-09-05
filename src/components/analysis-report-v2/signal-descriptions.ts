// 공통 척도 아홉 개의 등급별 해설 매트릭스(v2.3).
// 학부모 결과지 04 질문별 해석·강사 시트가 같은 매트릭스를 공유한다(중복 정의 금지).
// 등급: high=잘 되고 있음(≥75) / mid=지켜볼 것(62.5~75) / low=먼저 도울 것(<62.5) / insufficient.
// 각 등급은 3요소: state(한 줄 답 + 상태) · example(실제 학습 장면) · help(학원에서 어떻게 시작하나).
// 점수 로직은 바꾸지 않고 표시용 결정론적 문구만 제공한다. 유형 이름·낙인 표현 금지, 초등학생도 아는 낱말.

import type { CommonConstruct, Score } from "@/lib/assessment/v2/types";
import { gradeOf } from "@/lib/assessment/v2/scoring";

export type SignalBand = "high" | "mid" | "low";

/** 등급별 3요소 해설. */
export interface BandDesc {
  state: string; // 이 등급이 뜻하는 상태(행동)
  example: string; // 실제 학습 장면에서 어떻게 나타나는지
  help: string; // 학원에서 어떻게 시작하면 좋아지는지
}

export const SIGNAL_BAND_LABEL: Record<SignalBand, string> = {
  high: "잘 되고 있음",
  mid: "지켜볼 것",
  low: "먼저 도울 것",
};

export const SIGNAL_INSUFFICIENT = "정보 부족 · 상담 확인 필요";

/** 점수 → 등급. insufficient는 null. */
export function signalBandOf(score: Score): SignalBand | null {
  const grade = gradeOf(score);
  if (!grade) return null;
  return grade === "good" ? "high" : grade === "watch" ? "mid" : "low";
}

/** 등급 → 색 톤(UI 클래스용). */
export function signalToneOf(band: SignalBand | null): "high" | "mid" | "low" | "none" {
  return band ?? "none";
}

/** 3요소를 한 문단으로 합친다. */
export function describeBand(d: BandDesc): string {
  return `${d.state} ${d.example} ${d.help}`;
}

/** 질문에 대한 한 줄 답(결과지 04 첫 줄). 문항표 §4.3. */
export const ANSWER_LINE: Record<CommonConstruct, Record<SignalBand, string>> = {
  learningAttitude: { high: "열심히 합니다.", mid: "절반쯤 합니다.", low: "아직 열심히 하는 습관이 없습니다." },
  homeworkReliability: { high: "숙제를 잘 합니다.", mid: "숙제를 절반쯤 합니다.", low: "숙제 습관이 아직 없습니다." },
  goalClarity: { high: "목표가 뚜렷하고 할 일까지 정합니다.", mid: "목표는 있지만 할 일로 이어지지 않습니다.", low: "목표가 아직 뚜렷하지 않습니다." },
  shortTermRecovery: { high: "힘들어도 계속합니다.", mid: "힘들면 느려집니다.", low: "힘들면 멈췄다가 늦게 다시 시작합니다." },
  managementAcceptance: { high: "관리를 잘 받아들입니다.", mid: "관리를 받아들이지만 힘들어할 수 있습니다.", low: "관리를 힘들어합니다." },
  coachingResponse: { high: "세게 말해도 잘 따라옵니다.", mid: "세게 말하되 잘한 점도 같이 말해야 합니다.", low: "차분히 다독이며 가야 합니다." },
  questionInitiative: { high: "활기차게 먼저 묻습니다.", mid: "가끔 묻습니다.", low: "먼저 묻는 편이 아닙니다." },
  phoneBoundary: { high: "휴대폰을 잘 치웁니다.", mid: "휴대폰에 가끔 흔들립니다.", low: "휴대폰에 자주 흔들립니다." },
  peerFocusBoundary: { high: "친구가 있어도 할 일을 합니다.", mid: "친구가 옆에 있으면 가끔 미룹니다.", low: "친구가 옆에 있으면 자주 미룹니다." },
};

export const SIGNAL_DESC: Record<CommonConstruct, Record<SignalBand, BandDesc>> = {
  learningAttitude: {
    high: {
      state: "수업 중 중요한 것을 적고, 시키지 않아도 스스로 공부하는 쪽으로 답했습니다.",
      example: "배운 날 다시 보고, 하루 한 시간 넘게 혼자 공부하는 날이 많습니다.",
      help: "따로 붙잡지 않고 정규 수업으로 시작합니다.",
    },
    mid: {
      state: "수업은 잘 듣지만 스스로 공부하는 시간은 들쭉날쭉하다고 답했습니다.",
      example: "시험 앞에서는 열심히 하다가 평소에는 복습이 빠지는 날이 있습니다.",
      help: "그날 배운 것을 10분만 다시 보는 것부터 정해 줍니다.",
    },
    low: {
      state: "수업 중 표시·복습·스스로 공부하는 시간이 아직 습관이 아니라고 답했습니다.",
      example: "수업은 듣지만 끝나면 책을 덮고, 혼자 공부하는 시간이 거의 없습니다.",
      help: "첫 달은 자습 시간과 복습 분량을 학원이 정해 주고 확인합니다.",
    },
  },
  homeworkReliability: {
    high: {
      state: "답을 베끼지 않고 스스로 풀어 기한 안에 낸다고 답했습니다.",
      example: "내기 전에 빠진 것을 확인하고, 틀린 문제는 고쳐서 다시 풉니다.",
      help: "숙제 분량을 처음부터 정상 기준으로 주고 제출 상태만 확인합니다.",
    },
    mid: {
      state: "숙제는 내지만 스스로 풀기·다시 풀기가 절반쯤이라고 답했습니다.",
      example: "기한은 지키지만 어려운 문제는 답을 보고 넘어가는 날이 있습니다.",
      help: "답지 없이 푸는 시간을 따로 두고, 틀린 문제 하나만 다시 풀게 합니다.",
    },
    low: {
      state: "숙제를 스스로 풀어 기한 안에 내는 습관이 아직 없다고 답했습니다.",
      example: "시작이 늦고, 일부만 해 오거나 답을 베껴 오는 날이 있습니다.",
      help: "양을 늘리지 않고 '몇 시에 시작'을 함께 정해 시작만 먼저 확인합니다.",
    },
  },
  goalClarity: {
    high: {
      state: "목표 점수를 말할 수 있고 이번 주 할 공부를 미리 정해 둔다고 답했습니다.",
      example: "왜 공부하는지 스스로 말하고, 계획표대로 한 주를 움직입니다.",
      help: "목표를 학원 계획에 그대로 옮기고 한 주 단위로만 점검합니다.",
    },
    mid: {
      state: "목표는 있지만 이번 주 할 일로 이어지지 않는다고 답했습니다.",
      example: "시험 목표 점수는 말하지만 이번 주 무엇을 할지는 정해 두지 않습니다.",
      help: "첫 달은 주간 할 일을 함께 적는 것부터 시작합니다.",
    },
    low: {
      state: "목표가 아직 뚜렷하지 않고 시키는 대로만 한다고 답했습니다.",
      example: "왜 공부하는지 물으면 답이 막히고, 계획 없이 그날그날 합니다.",
      help: "작은 목표 하나(이번 주 오답 세 개)부터 정해 주고 끝내는 경험을 쌓게 합니다.",
    },
  },
  shortTermRecovery: {
    high: {
      state: "낮은 점수를 받아도 다시 시작하고, 더 시켜도 끝까지 한다고 답했습니다.",
      example: "틀렸다는 설명을 들은 날 바로 다시 풀고, 힘든 과제도 끝까지 냅니다.",
      help: "힘든 구간을 따로 잡아 주지 않아도 정규 과제로 시작합니다.",
    },
    mid: {
      state: "힘들면 느려지지만 멈추지는 않는다고 답했습니다.",
      example: "낮은 점수를 받은 날은 하루쯤 미루다가 다음 날 다시 시작합니다.",
      help: "점수가 나온 다음 날 할 일 하나를 미리 정해 줍니다.",
    },
    low: {
      state: "낮은 점수 뒤에 다음 공부를 미루고, 힘들면 멈추는 쪽으로 답했습니다.",
      example: "어려운 문제를 만나면 그날 공부 전체가 흔들리는 날이 있습니다.",
      help: "점수가 나온 뒤 이틀 안에 할 일을 잘게 쪼개 손에 쥐여 줍니다.",
    },
  },
  managementAcceptance: {
    high: {
      state: "남으라고 하면 남고, 매일 확인해 주는 방식이 필요하다고 답했습니다.",
      example: "검사와 지적이 많아도 다니기 싫어지지 않는다고 답했습니다.",
      help: "NK의 관리 방식을 그대로 적용합니다.",
    },
    mid: {
      state: "관리를 받아들이지만 검사와 지적이 많으면 힘들어할 수 있다고 답했습니다.",
      example: "남으라고 하면 남지만, 지적이 이어지면 다니기 싫어지는 쪽으로 기웁니다.",
      help: "관리 방식을 미리 알려 주고 첫 달은 부담을 조절합니다.",
    },
    low: {
      state: "검사와 지적이 많은 관리를 힘들어한다고 답했습니다.",
      example: "남아서 하라고 하면 빠지거나, 검사가 많으면 다니기 싫어집니다.",
      help: "처음에는 확인 횟수를 줄이고, 지킨 것을 먼저 알아봐 주며 늘려 갑니다.",
    },
  },
  coachingResponse: {
    high: {
      state: "세게 지적받으면 더 열심히 하고 기분이 오래 상하지 않는다고 답했습니다.",
      example: "고칠 점을 바로 말해 주는 쪽이 편하다고 답했습니다.",
      help: "고칠 점을 돌려 말하지 않고 바로 짚어 줍니다.",
    },
    mid: {
      state: "세게 말해도 따라오지만 크게 혼나면 피한 적도 있다고 답했습니다.",
      example: "바로 짚어 주는 것은 괜찮지만, 여러 번 혼나면 그 과목을 피하는 쪽으로 기웁니다.",
      help: "바로 짚되 잘한 점을 먼저 말합니다.",
    },
    low: {
      state: "크게 혼나면 그 과목이 싫어지고 기분이 오래 남는다고 답했습니다.",
      example: "세게 지적받은 뒤 다음 수업에 오기 싫어한 적이 있습니다.",
      help: "지적은 1:1로 한 번에 하나만 하고, 잘한 점을 먼저 말한 뒤 고쳐 줍니다.",
    },
  },
  questionInitiative: {
    high: {
      state: "모르면 바로 손을 들고, 수업 중 소리 내어 답한다고 답했습니다.",
      example: "새 반에서도 먼저 질문하고, 물어볼 것을 넘기지 않습니다.",
      help: "질문 통로를 따로 만들지 않아도 수업 중 바로 묻게 둡니다.",
    },
    mid: {
      state: "가끔은 묻지만 넘어가는 날도 있다고 답했습니다.",
      example: "편한 선생님에게는 묻지만 새 반에서는 조용해집니다.",
      help: "수업 끝에 질문 하나를 꼭 확인하는 규칙을 둡니다.",
    },
    low: {
      state: "모르는 것이 있어도 먼저 묻지 않고 넘어간다고 답했습니다.",
      example: "손을 들지 않고, 답을 소리 내어 말하지 않습니다.",
      help: "담당 강사가 먼저 막힌 지점을 묻는 방식으로 첫 달을 시작합니다.",
    },
  },
  phoneBoundary: {
    high: {
      state: "공부 전에 휴대폰을 치우고 쓰는 시간을 스스로 정해 지킨다고 답했습니다.",
      example: "휴대폰을 봐도 5분 안에 공부로 돌아옵니다.",
      help: "지금 습관을 그대로 인정하고 시험 기간에도 유지하게 합니다.",
    },
    mid: {
      state: "휴대폰을 치우기는 하지만 공부 중 습관처럼 여는 날이 있다고 답했습니다.",
      example: "알림이 오면 확인하고, 다시 돌아오기까지 시간이 걸립니다.",
      help: "자습 시작 시 휴대폰을 맡기는 규칙을 그대로 지킵니다.",
    },
    low: {
      state: "공부 중 휴대폰을 자주 열고 시간을 정해 지키지 못한다고 답했습니다.",
      example: "숙제를 펴 놓고도 휴대폰 때문에 흐름이 자주 끊깁니다.",
      help: "공부 시작 전에 휴대폰을 정해진 곳에 두는 것부터 학원에서 함께 합니다.",
    },
  },
  peerFocusBoundary: {
    high: {
      state: "친구가 놀자고 해도 할 일을 먼저 끝낸다고 답했습니다.",
      example: "친구와 같이 있어도 정한 공부 시간은 지킵니다.",
      help: "자리 배치를 따로 신경 쓰지 않아도 됩니다.",
    },
    mid: {
      state: "친구가 옆에 있으면 가끔 할 일을 미룬다고 답했습니다.",
      example: "이야기하다 보면 할 일이 뒤로 밀리는 날이 있습니다.",
      help: "할 일을 마친 뒤 쉬게 하고, 친한 친구와는 자리를 조금 띄웁니다.",
    },
    low: {
      state: "친구와 이야기하느라 할 일을 자주 미룬다고 답했습니다.",
      example: "친구가 놀자고 하면 공부를 뒤로 미루는 쪽으로 답했습니다.",
      help: "자리를 먼저 정하고, 할 일을 마친 뒤에 쉬게 합니다.",
    },
  },
};

// 과목 학습전략 신호(선택 과목).
export const SUBJECT_SIGNAL_DESC: Record<"math" | "english", Record<SignalBand, BandDesc>> = {
  math: {
    high: {
      state: "수학을 공부하는 여러 방법을 자주 쓴다고 답했습니다.",
      example: "조건을 정리하고, 틀린 이유를 나눠 보고, 검산합니다.",
      help: "지금 방식을 유지하며 오답을 시험 범위별로 모아 둡니다.",
    },
    mid: {
      state: "수학 공부 방법을 쓰는 정도가 상황에 따라 달라진다고 답했습니다.",
      example: "풀 때는 이해하지만 비슷한 유형을 며칠 뒤 다시 틀리는 경우가 있습니다.",
      help: "틀린 문제를 3일 뒤 다시 푸는 것을 정해진 순서로 만듭니다.",
    },
    low: {
      state: "수학 공부 방법을 꾸준히 쓰는 일이 아직 어렵다고 답했습니다.",
      example: "답만 맞히려 하고 틀린 이유를 넘겨 같은 실수가 반복됩니다.",
      help: "틀린 이유를 한 줄로 적는 것부터 작게 시작합니다.",
    },
  },
  english: {
    high: {
      state: "영어를 공부하는 여러 방법을 자주 쓴다고 답했습니다.",
      example: "단어를 날짜를 나눠 반복하고, 글에서 답의 근거를 찾습니다.",
      help: "지금 방식을 유지하며 틀린 문장의 구조를 다시 표시해 둡니다.",
    },
    mid: {
      state: "영어 공부 방법을 쓰는 정도가 상황에 따라 달라진다고 답했습니다.",
      example: "단어는 외우지만 시간이 지나면 잊고, 긴 지문에서 흐름을 놓칠 때가 있습니다.",
      help: "매일 짧은 단어 복습과 문장 구조 표시를 정해진 순서로 만듭니다.",
    },
    low: {
      state: "영어 공부 방법을 꾸준히 쓰는 일이 아직 어렵다고 답했습니다.",
      example: "단어 외우기가 들쭉날쭉하고 긴 지문은 끝까지 읽기 어려워합니다.",
      help: "하루 10개 단어 복습과 한 문장 구조 표시부터 작게 시작합니다.",
    },
  },
};
