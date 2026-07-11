// 핵심 신호(공용) 점수 구간별 특징 해설 매트릭스.
// 학부모 결과지의 항목별 분석·약점 섹션이 같은 매트릭스를 공유한다(중복 정의 금지).
// 모든 common 점수는 높을수록 안정적(§8.1). 구간: high≥65 / mid 45~64 / low<45 / insufficient.
// 각 구간은 3요소로 구성한다: state(상태) · example(실제 학습 장면 예) · help(가정·학원 도움 팁).
// 데이터·점수 로직은 바꾸지 않고 표시용 결정론적 문구만 제공한다. 낙인 표현 금지(행동 관찰 기반).

import type { Score } from "@/lib/assessment/v2/types";
import { isNum } from "./report-theme";

export type SignalBand = "high" | "mid" | "low";

/** 밴드별 3요소 해설. */
export interface BandDesc {
  state: string; // 이 점수가 뜻하는 상태(행동 특징)
  example: string; // 실제 학습 장면에서 어떻게 나타나는지 구체 예
  help: string; // 가정·학원에서 어떻게 도우면 좋아지는지 팁
}

export const SIGNAL_BAND_LABEL: Record<SignalBand, string> = {
  high: "안정적",
  mid: "보통",
  low: "먼저 도와줄 부분",
};

export const SIGNAL_INSUFFICIENT = "정보 부족 · 상담 확인 필요";

/** 점수 → 밴드. insufficient는 null. */
export function signalBandOf(score: Score): SignalBand | null {
  if (!isNum(score)) return null;
  if (score >= 65) return "high";
  if (score >= 45) return "mid";
  return "low";
}

/** 밴드 → 색 톤(UI 클래스용). */
export function signalToneOf(band: SignalBand | null): "high" | "mid" | "low" | "none" {
  return band ?? "none";
}

/** 3요소를 한 문단(3문장)으로 합친다(항목별 분석 카드). */
export function describeBand(d: BandDesc): string {
  return `${d.state} ${d.example} ${d.help}`;
}

// 핵심 6신호.
export const SIGNAL_DESC: Record<string, Record<SignalBand, BandDesc>> = {
  learningAttitude: {
    high: {
      state: "수업에 집중해 들어오고 중요한 내용을 스스로 챙겨요.",
      example: "선생님이 설명할 때 눈과 손이 함께 따라오고, 필기와 질문이 자연스럽게 이어집니다.",
      help: "아는 내용이 반복될 때는 짧게 설명을 시켜 보면 집중이 더 오래 갑니다.",
    },
    mid: {
      state: "수업은 대체로 잘 따라오지만 집중이 오르내려요.",
      example: "새로운 단원은 잘 듣다가, 아는 내용이 반복되면 딴생각으로 빠지는 날이 있습니다.",
      help: "몇 분마다 확인 질문을 던지거나 배운 내용을 설명하게 하면 참여가 이어집니다.",
    },
    low: {
      state: "수업 집중이 자주 끊겨요.",
      example: "설명 중간에 멍해지거나 다른 곳에 눈이 가서 중요한 내용을 놓치는 날이 많습니다.",
      help: "짧게 끊어 확인 질문을 하고, 배운 내용을 바로 말로 설명하게 하면 참여가 살아납니다.",
    },
  },
  homeworkReliability: {
    high: {
      state: "숙제를 기한 안에 해오는 습관이 잘 잡혀 있어요.",
      example: "정해진 날짜에 맞춰 스스로 시작하고, 밀리는 날이 드뭅니다.",
      help: "제출 확인에 더해 틀린 문제를 3일 뒤 다시 풀게 하면 실력으로 굳습니다.",
    },
    mid: {
      state: "숙제는 대체로 해오지만 마감에 몰리는 편이에요.",
      example: "제출은 하지만 하루 전날 몰아서 하느라 완성도가 들쭉날쭉합니다.",
      help: "시작 시각을 정해 두고 분량을 이틀로 나눠 주면 흐름이 안정됩니다.",
    },
    low: {
      state: "숙제 시작을 자주 미뤄요.",
      example: "책은 펴 두지만 시작이 늦고, 제출을 못 하거나 일부만 해오는 날이 있습니다.",
      help: "양을 늘리기보다 '몇 시에 시작'을 함께 정하고, 시작만 확인해 주면 좋습니다.",
    },
  },
  phoneBoundary: {
    high: {
      state: "공부할 때 휴대폰을 스스로 정리하는 편이에요.",
      example: "공부 시작 전에 알림을 끄거나 멀리 두어 집중이 크게 흔들리지 않습니다.",
      help: "지금 습관을 칭찬해 주고, 시험 기간에도 같은 방식을 유지하도록 도와주세요.",
    },
    mid: {
      state: "대체로 조절하지만 곁에 있으면 가끔 흔들려요.",
      example: "집중하다가도 알림이 울리면 잠깐 확인하고, 다시 돌아오기까지 시간이 걸립니다.",
      help: "공부 시작 전에 휴대폰을 눈에 보이지 않는 곳에 두는 것부터 연습하면 좋습니다.",
    },
    low: {
      state: "공부를 시작할 때 휴대폰을 자동으로 확인하는 습관이 있어요.",
      example: "숙제를 펴 놓고도 알림이 오면 흐름이 끊기고, 다시 집중하기까지 오래 걸립니다.",
      help: "처음 2주는 공부 시작 전에 휴대폰을 다른 방에 두는 것부터 함께 연습하면 좋습니다.",
    },
  },
  longTermPersistence: {
    high: {
      state: "목표를 향해 꾸준히 버티는 힘이 좋아요.",
      example: "한 번 세운 계획을 몇 주 동안 흔들림 없이 이어 갑니다.",
      help: "중간 목표를 함께 점검해 성취감을 확인시켜 주면 동력이 더 오래갑니다.",
    },
    mid: {
      state: "목표는 있지만 중간에 느슨해질 때가 있어요.",
      example: "처음엔 열심히 하다가 2~3주 지나면 페이스가 떨어지는 흐름이 보입니다.",
      help: "큰 목표를 2~3주 단위로 쪼개고 주간 점검으로 다시 끌어올리면 좋습니다.",
    },
    low: {
      state: "목표를 오래 유지하기 어려워해요.",
      example: "결심은 하지만 며칠 안에 흐지부지되어 계획이 자주 바뀝니다.",
      help: "일주일짜리 작은 목표부터 시작해 끝내는 경험을 쌓아 주면 힘이 붙습니다.",
    },
  },
  shortTermRecovery: {
    high: {
      state: "점수가 낮거나 막혀도 금방 다시 시작해요.",
      example: "틀린 시험 뒤에도 오래 좌절하지 않고 바로 다음 공부로 넘어갑니다.",
      help: "무엇을 어떻게 다시 했는지 말로 정리하게 하면 회복 방법이 습관으로 남습니다.",
    },
    mid: {
      state: "대체로 회복하지만 다시 시작까지 조금 걸려요.",
      example: "실수한 날은 잠깐 의욕이 떨어졌다가 하루 이틀 뒤 돌아오는 편입니다.",
      help: "막힌 직후 '다음 한 문제부터'처럼 아주 작은 시작점을 정해 주면 빨라집니다.",
    },
    low: {
      state: "막히거나 틀린 뒤 오래 멈춰 있는 편이에요.",
      example: "한 번 어려운 문제를 만나면 그날 공부 전체가 흔들리는 날이 있습니다.",
      help: "바로 다음 한 걸음을 함께 정하고, 결과보다 다시 시작한 것을 칭찬해 주세요.",
    },
  },
  peerLearningResource: {
    high: {
      state: "친구와 함께 공부하는 것이 서로에게 힘이 되는 편이에요.",
      example: "같이 문제를 설명하거나 확인하며 좋은 자극을 주고받습니다.",
      help: "짝 학습 시간을 인정해 주되, 혼자 집중하는 시간과 균형을 잡아 주면 좋습니다.",
    },
    mid: {
      state: "친구 영향이 상황에 따라 갈려요.",
      example: "도움이 될 때도 있지만, 옆자리에 따라 집중이 흐트러지는 날도 있습니다.",
      help: "짝 확인 시간과 혼자 집중 시간을 나눠 배치해 주면 장점만 살릴 수 있습니다.",
    },
    low: {
      state: "아직 친구가 공부에 큰 힘이 되지는 않아요.",
      example: "함께 있으면 대화로 흘러 집중 시간이 줄어드는 편입니다.",
      help: "당분간 혼자 집중할 수 있는 자리를 마련하고, 짧은 확인만 함께하게 해주세요.",
    },
  },
};

// 과목 학습전략 신호(선택 과목).
export const SUBJECT_SIGNAL_DESC: Record<"math" | "english", Record<SignalBand, BandDesc>> = {
  math: {
    high: {
      state: "수학 학습 방법이 자리 잡혀 있어요.",
      example: "개념을 자기 말로 설명하고 틀린 이유를 개념·계산·조건으로 나눠 봅니다.",
      help: "지금 방식을 유지하며 오답 노트를 시험 범위별로 모아 두면 더 단단해집니다.",
    },
    mid: {
      state: "수학 기본 방법은 있지만 꾸준함이 필요해요.",
      example: "풀 때는 이해하지만 비슷한 유형을 며칠 뒤 다시 틀리는 경우가 있습니다.",
      help: "틀린 문제를 3일 뒤 다시 푸는 간격 복습을 루틴으로 만들면 좋습니다.",
    },
    low: {
      state: "수학 학습 방법을 함께 잡아 가야 해요.",
      example: "답만 맞히려 하고 틀린 이유를 넘겨, 같은 실수가 반복됩니다.",
      help: "개념을 소리 내어 설명하고 오답 이유를 한 줄로 적는 것부터 작게 시작하면 좋습니다.",
    },
  },
  english: {
    high: {
      state: "영어 학습 방법이 자리 잡혀 있어요.",
      example: "단어를 꾸준히 복습하고 문장 구조와 근거를 표시하며 읽습니다.",
      help: "지금 방식을 유지하며 틀린 문장의 구조를 다시 표시해 두면 독해가 더 안정됩니다.",
    },
    mid: {
      state: "영어 기본 방법은 있지만 꾸준함이 필요해요.",
      example: "단어는 외우지만 시간이 지나면 잊고, 긴 지문에서 흐름을 놓칠 때가 있습니다.",
      help: "매일 짧은 단어 복습과 문장 구조 표시를 루틴으로 만들면 좋습니다.",
    },
    low: {
      state: "영어 학습 방법을 함께 잡아 가야 해요.",
      example: "단어 암기가 들쭉날쭉하고 긴 지문은 끝까지 읽기 어려워합니다.",
      help: "하루 10개 단어 복습과 한 문장 구조 표시부터 작게 시작하면 좋습니다.",
    },
  },
};
