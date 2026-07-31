import { describe, expect, it } from "vitest";
import {
  detectSignals,
  estimateDepartureTarget,
  hasThinSummary,
  isParentOpinionCopied,
} from "../signals";
import type { Withdrawal } from "@/types";

function mk(overrides: Partial<Withdrawal> = {}): Withdrawal {
  return {
    id: "row-1",
    name: "김지민",
    student_opinion: null,
    parent_opinion: null,
    teacher_opinion: null,
    final_consult_summary: null,
    special_notes: null,
    ...overrides,
  } as Withdrawal;
}

// 아래 문장은 운영 DB 원문에서 가져온 실제 표현을 축약한 것이다.
describe("detectSignals", () => {
  it("숙제 부담 서술에서 참여·적합 신호를 잡는다", () => {
    const { topics } = detectSignals(
      mk({ teacher_opinion: "숙제의 양이 많다고 느껴 힘들어 하고 어려운 내용에 일일테스트 점수가 잘 나오지 않아 속상해함" }),
    );
    expect(topics).toContain("engagement");
    expect(topics).toContain("fit");
    expect(topics).toContain("performance");
  });

  it("윈터스쿨 이동은 대안 교육 신호다", () => {
    const { topics } = detectSignals(mk({ final_consult_summary: "윈터스쿨로 인하여 휴원한다고 함." }));
    expect(topics).toContain("alternative");
  });

  it("인강·독학 서술도 대안 교육으로 잡는다", () => {
    const { topics } = detectSignals(
      mk({ student_opinion: "메가스터디 인강을 수강하기로 했다고 함." }),
    );
    expect(topics).toContain("alternative");
  });

  it("픽드랍·체력 서술은 일정 신호다", () => {
    const { topics } = detectSignals(
      mk({ parent_opinion: "아버님이 일정상 픽드랍이 어려워지며 학원을 옮겨보기로 결정하심" }),
    );
    expect(topics).toContain("schedule");
  });

  it("합반·적응 서술은 적합 신호다", () => {
    const { topics } = detectSignals(
      mk({ teacher_opinion: "합반되며 반 변경으로 적응이 되지 않은듯함" }),
    );
    expect(topics).toContain("fit");
  });

  // teaching은 오탐 위험이 커서 보수적으로 잡는다.
  it("중립적인 '선생님'·'설명' 언급만으로는 수업·소통 신호를 만들지 않는다", () => {
    const { topics } = detectSignals(
      mk({ final_consult_summary: "담당 선생님이 학원 커리큘럼 설명 및 수업태도 관련 상담" }),
    );
    expect(topics).not.toContain("teaching");
  });

  it("불만 문맥이 분명하면 수업·소통 신호를 잡는다", () => {
    const { topics } = detectSignals(
      mk({ student_opinion: "개념 수업이 너무 많아 지루함을 느낌" }),
    );
    expect(topics).toContain("teaching");
  });

  it("근거 스니펫에 출처 필드와 매칭 키워드를 남긴다", () => {
    const { matches } = detectSignals(mk({ teacher_opinion: "숙제를 자주 미제출함" }));
    const hit = matches.find((m) => m.topic === "engagement");
    expect(hit?.field).toBe("teacher_opinion");
    expect(hit?.snippet).toContain("숙제");
  });

  it("자유서술이 없으면 신호가 없다", () => {
    expect(detectSignals(mk()).topics).toEqual([]);
  });
});

describe("isParentOpinionCopied", () => {
  it("완전히 같으면 복사로 본다", () => {
    expect(
      isParentOpinionCopied(
        mk({ student_opinion: "윈터스쿨로 인하여 휴원한다고 함.", parent_opinion: "윈터스쿨로 인하여 휴원한다고 함." }),
      ),
    ).toBe(true);
  });

  it("공백만 다른 경우도 복사로 본다", () => {
    expect(
      isParentOpinionCopied(
        mk({ student_opinion: "윈터스쿨로 인하여 휴원한다고 함", parent_opinion: "윈터스쿨로  인하여 휴원한다고 함" }),
      ),
    ).toBe(true);
  });

  it("한쪽이 다른 쪽을 통째로 포함해도 복사로 본다", () => {
    expect(
      isParentOpinionCopied(
        mk({ student_opinion: "성적이 오르지 않아 속상해함", parent_opinion: "성적이 오르지 않아 속상해함 그래서 옮기기로 함" }),
      ),
    ).toBe(true);
  });

  it("한쪽이 비어 있으면 복사가 아니다", () => {
    expect(isParentOpinionCopied(mk({ student_opinion: "성적 불만족", parent_opinion: null }))).toBe(false);
  });

  it("서로 다른 진술은 복사가 아니다", () => {
    expect(
      isParentOpinionCopied(
        mk({ student_opinion: "숙제가 많아 힘들다", parent_opinion: "픽드랍이 어려워졌다" }),
      ),
    ).toBe(false);
  });
});

describe("hasThinSummary", () => {
  it("30자 미만이면 얇은 요약이다", () => {
    expect(hasThinSummary(mk({ final_consult_summary: "위와 동일" }))).toBe(true);
    expect(hasThinSummary(mk({ final_consult_summary: null }))).toBe(true);
  });

  it("30자 이상이면 아니다", () => {
    expect(
      hasThinSummary(mk({ final_consult_summary: "가".repeat(30) })),
    ).toBe(false);
  });
});

describe("estimateDepartureTarget", () => {
  it("윈터스쿨·기숙은 타학원으로 본다", () => {
    expect(estimateDepartureTarget(mk({ final_consult_summary: "윈터스쿨로 인하여 휴원" }))).toBe("academy");
  });

  it("과외 언급은 과외", () => {
    expect(estimateDepartureTarget(mk({ parent_opinion: "과외로 전환하기로 함" }))).toBe("tutor");
  });

  it("인강·독학은 온라인", () => {
    expect(estimateDepartureTarget(mk({ student_opinion: "메가스터디 인강 수강" }))).toBe("online");
  });

  it("휴식·휴원만 있으면 휴식", () => {
    expect(estimateDepartureTarget(mk({ teacher_opinion: "학생의 휴식을 위해 퇴원" }))).toBe("rest");
  });

  it("단서가 없으면 불명", () => {
    expect(estimateDepartureTarget(mk({ teacher_opinion: "개인 사정" }))).toBe("unknown");
  });
});
