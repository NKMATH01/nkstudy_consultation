import { describe, it, expect } from "vitest";
import { ALL_ITEMS, isLikert } from "../definition";
import { computeScoreProfile } from "../scoring";
import {
  buildAiSafeInput,
  buildV2AnalysisPrompt,
  redactNarrative,
  type IntakeV2,
} from "../serializer";
import type { LikertItem, ResponseMap, ScoreProfile, SubjectSelection } from "../types";

const LIKERT = ALL_ITEMS.filter(isLikert) as LikertItem[];

function fillResponses(value: number): ResponseMap {
  const r: ResponseMap = {};
  for (const item of LIKERT) r[item.id] = value;
  return r;
}

function profileFor(selection: SubjectSelection): ScoreProfile {
  return computeScoreProfile({
    subjectSelection: selection,
    responses: fillResponses(4),
    scenarioResponses: { C1: 3, C2: 2, MS1: 4, MS2: 3, ES1: 3, ES2: 4 },
    mbti: { type: "INTP", confidence: "high" },
    clinicAvailability: 100,
  });
}

// PII가 곳곳에 섞인 가상 학생 fixture (실학생 아님).
const FIXTURE_INTAKE: IntakeV2 = {
  name: "김민준",
  school: "안산고등학교",
  grade: "고1",
  subjectSelection: "both",
  studentPhone: "010-1234-5678",
  parentPhone: "010-9876-5432",
  prevAcademy: "종로엠스쿨",
  prevAcademyDuration: "2년",
  prevSwitchReason: "이사로 인한 이동",
  prevComplaint: "관리가 부족하다고 느꼈어요",
  referralPath: "친구 소개",
  referralFriendName: "이서연",
  nkAwareness: "잘 모름",
  nkExpectations: ["철저한 숙제 관리", "1:1 질문·개별 피드백", "주간 테스트·재보완"],
  preferredDays: "월수금",
  availableTime: "오후 6시 이후",
  weekdaySelfStudy: "주 3회",
  clinicAvailabilityChoice: "정규수업 뒤 정기 참여 가능",
  commuteMethod: "도보",
  commuteTime: "10분",
  hasFuturePlan: "있음",
  dreamJob: "의사가 되고 싶어요. 연락은 010-1234-5678 로 주세요.",
  targetUniversity: "서울대 의예과",
  studyCore: "김민준 생각에는 꾸준함이 핵심입니다. 메일 test@example.com 로 문의했어요.",
  selfProblem: "집중이 오래 안 가요",
  mathDifficulty: "함수와 미적분 단원이 어려워요",
  englishDifficulty: "긴 지문 독해가 약해요",
  healthNote: "천식이 있어 흡입기를 사용합니다",
  requests: "잘 부탁드립니다",
  mbtiType: "INTP",
  mbtiConfidence: "높음",
};

const FORBIDDEN = [
  "김민준", // 학생 이름
  "안산고등학교", // 정확한 학교명
  "종로엠스쿨", // 기존 학원 고유명
  "이서연", // 추천인 이름
  "천식", // 건강 정보
  "흡입기",
  "010-1234-5678", // 학생 연락처
  "1234-5678",
  "9876-5432", // 학부모 연락처
  "test@example.com", // 이메일
];

describe("serializer redaction snapshot (§11 / §15.2)", () => {
  it("직렬화 결과에 §11 전송 금지 필드·패턴이 하나도 없다", () => {
    const profile = profileFor("both");
    const aiInput = buildAiSafeInput({
      scoreProfile: profile,
      intake: FIXTURE_INTAKE,
      responses: fillResponses(4),
    });
    const json = JSON.stringify(aiInput);
    for (const forbidden of FORBIDDEN) {
      expect(json).not.toContain(forbidden);
    }
  });

  it("프롬프트 문자열에도 금지 패턴이 없다", () => {
    const profile = profileFor("both");
    const aiInput = buildAiSafeInput({
      scoreProfile: profile,
      intake: FIXTURE_INTAKE,
      responses: fillResponses(4),
    });
    const prompt = buildV2AnalysisPrompt(aiInput);
    for (const forbidden of FORBIDDEN) {
      expect(prompt).not.toContain(forbidden);
    }
  });

  it("총평을 학생 묘사 전용으로 제한한다", () => {
    const profile = profileFor("both");
    const aiInput = buildAiSafeInput({
      scoreProfile: profile,
      intake: FIXTURE_INTAKE,
      responses: fillResponses(4),
    });
    const prompt = buildV2AnalysisPrompt(aiInput);
    expect(prompt).toContain("[총평 관점 — 매우 중요]");
    expect(prompt).toContain('목적은 "우리 아이가 어떤 학생인지" 파악입니다.');
    expect(prompt).toContain("학원·강사·상담자·NK가 주어인 문장");
    expect(prompt).toContain("NK 적합도·운영 방식 언급을 모두 금지합니다.");
    expect(prompt).toContain("마지막 문단만 가정에서 지켜봐 주시면 좋은 점");
    expect(prompt).not.toContain("학부모와 상담자가 함께 읽는 상세 총평");
  });

  it("특징 서술을 실제 응답과 서버 계산 근거에 묶는다", () => {
    const profile = profileFor("both");
    const aiInput = buildAiSafeInput({
      scoreProfile: profile,
      intake: FIXTURE_INTAKE,
      responses: fillResponses(4),
    });
    const prompt = buildV2AnalysisPrompt(aiInput);
    expect(prompt).toContain("[근거 기반 서술 — 매우 중요]");
    expect(prompt).toContain("특정 문항의 실제 응답 경향");
    expect(prompt).toContain("입력에 없는 일화·습관·사실을 만들어내지 마세요.");
    expect(prompt).toContain("그 요지를 detailedSummary에 최소 1회");
  });

  it("허용 필드는 정상 포함된다 (학교급·학년숫자·NK기대·점수·과목 어려움)", () => {
    const profile = profileFor("both");
    const aiInput = buildAiSafeInput({
      scoreProfile: profile,
      intake: FIXTURE_INTAKE,
      responses: fillResponses(4),
    });
    expect(aiInput.student.schoolLevel).toBe("고등");
    expect(aiInput.student.grade).toBe(1);
    expect(aiInput.narratives.nkExpectations).toContain("철저한 숙제 관리");
    expect(aiInput.narratives.mathDifficulty).toContain("함수");
    expect(aiInput.narratives.selfPerception).toContain("꾸준함"); // 이름만 마스킹
    expect(aiInput.scores).toBe(profile); // 점수는 서버 프로필 그대로
  });

  it("NK 기대는 최대 3개까지만 전송한다", () => {
    const profile = profileFor("both");
    const aiInput = buildAiSafeInput({
      scoreProfile: profile,
      intake: { ...FIXTURE_INTAKE, nkExpectations: ["a", "b", "c", "d", "e"] },
    });
    expect(aiInput.narratives.nkExpectations).toHaveLength(3);
  });

  it("intake에 낯선 키(예: 원본 name 재삽입)가 있어도 읽지 않는다", () => {
    const profile = profileFor("math");
    // deny-by-default: allowlist 밖 키는 접근하지 않으므로 payload에 새지 않는다.
    const dirty = {
      ...FIXTURE_INTAKE,
      secretMemo: "내부 메모: 김민준 학생 010-1234-5678",
    } as unknown as IntakeV2;
    const aiInput = buildAiSafeInput({ scoreProfile: profile, intake: dirty });
    expect(JSON.stringify(aiInput)).not.toContain("내부 메모");
    expect(JSON.stringify(aiInput)).not.toContain("김민준");
  });
});

describe("redactNarrative", () => {
  it("전화번호·이메일·URL·SNS·긴 숫자열을 제거한다", () => {
    const out = redactNarrative(
      "연락처 010-1234-5678, 메일 a@b.com, https://x.io, @insta_id, 123456789012"
    );
    expect(out).not.toContain("010-1234-5678");
    expect(out).not.toContain("a@b.com");
    expect(out).not.toContain("https://x.io");
    expect(out).not.toContain("insta_id");
    expect(out).not.toContain("123456789012");
  });

  it("학생 이름이 서술에 등장하면 마스킹한다", () => {
    const out = redactNarrative("저는 김민준이고 김민준입니다", "김민준");
    expect(out).not.toContain("김민준");
    expect(out).toContain("○○");
  });

  it("길이를 제한한다", () => {
    const out = redactNarrative("가".repeat(500));
    expect(out.length).toBeLessThanOrEqual(301); // 300 + … 표시
  });

  it("빈 값은 빈 문자열", () => {
    expect(redactNarrative(null)).toBe("");
    expect(redactNarrative(undefined)).toBe("");
  });
});
