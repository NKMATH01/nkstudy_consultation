// 강사용 A4 시트 전용 문구. 학부모 결과지에는 쓰지 않는다.
//
// 학부모용 해설(signal-descriptions.ts)은 "이렇게 도와주세요"(행동형)만 담고 있다.
// 강사가 첫 수업에서 실제로 헷갈리는 건 "무엇부터 하지 말아야 하는가"라서,
// 같은 밴드 해설과 어긋나지 않는 범위에서 금지형 한 줄을 따로 둔다.
//
// 여기 문구는 점수를 만들지 않는다. 표시용 결정론적 텍스트일 뿐이다.

import type { SignalBand } from "./signal-descriptions";

/**
 * 약점 항목별 "먼저 하지 말 것" 한 줄.
 * 낙인이 아니라 흔한 첫 대응 실수를 막는 문장으로 쓴다.
 */
export const AVOID_LINE: Record<string, string> = {
  learningAttitude:
    "집중이 흐트러진 순간을 그 자리에서 지적하지 마세요. 아는 내용이 반복될 때 주로 생깁니다.",
  homeworkReliability:
    "안 해온 이유부터 묻지 마세요. 이유를 대는 자리가 되면 다음 주도 같아집니다.",
  phoneBoundary:
    "휴대폰을 걷는 것으로 시작하지 마세요. 보관 위치를 학생이 정하게 하는 편이 오래 갑니다.",
  longTermPersistence:
    "목표를 다시 세우자고 하지 마세요. 이번 주에 할 일 한 가지로 좁히는 게 먼저입니다.",
  shortTermRecovery:
    "점수를 확인한 직후에 다시 풀게 하지 마세요. 그 자리에서는 회피가 가장 큽니다.",
  mathStrategy: "문제 양을 늘리지 마세요. 풀이 과정을 적게 하는 쪽이 먼저입니다.",
  englishStrategy: "단어를 몰아서 외우게 하지 마세요. 날짜를 나눠 반복하는 쪽이 먼저입니다.",
};

/** 말 거는 방식 3구인의 첫 수업 처방 한 줄. */
export const TALK_PRESCRIPTION: Record<string, Record<SignalBand, string>> = {
  directFeedbackAcceptance: {
    high: "고칠 점을 돌려 말하지 말고 바로 짚어 주세요. 칭찬을 앞에 붙이지 않아도 됩니다.",
    mid: "고칠 점 하나를 분명히 짚고, 잘한 지점 하나를 함께 말해 주세요.",
    low: "지적은 1:1로 한 번에 하나만. 여러 사람 앞에서는 결과만 확인하세요.",
  },
  relationshipSafetyNeed: {
    high: "첫 2주는 이름을 부르고 짧게 안부를 물은 뒤 과제 이야기로 넘어가세요.",
    mid: "지적할 일이 생기면 자리를 옮겨 조용히 말해 주세요.",
    low: "본론부터 시작해도 괜찮습니다. 관계를 먼저 풀 필요는 없습니다.",
  },
  autonomyNeed: {
    high: "순서나 방법 중 하나는 학생이 고르게 하세요. 이유를 먼저 말하면 더 잘 따라옵니다.",
    mid: "두 가지 안을 주고 고르게 하세요.",
    low: "무엇을 언제까지 할지 정해서 주세요. 선택지를 늘리면 시작이 늦어집니다.",
  },
};

/** 응답이 부족해 밴드를 정할 수 없을 때. 추측 대신 확인을 지시한다. */
export const TALK_PRESCRIPTION_UNKNOWN =
  "설문 응답이 부족합니다. 첫 수업에서 직접 확인하세요.";
