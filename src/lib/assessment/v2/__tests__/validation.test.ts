import { describe, it, expect } from "vitest";
import {
  GUIDANCE_CHOICE_ID,
  INSTRUMENT_REVISION,
  MANAGEMENT_DIRECT_ID,
  getItemsForSubject,
  isChoiceItem,
  isLikert,
} from "../definition";
import { computeScoreProfile } from "../scoring";
import {
  DIFFICULTY_TAG_OPTIONS,
  buildScoringInput,
  buildV2InsertPayload,
  normalizePhone,
  v2SubmissionSchema,
  type V2SubmissionInput,
} from "../validation";
import type { SubjectSelection } from "../types";

/** 주어진 과목의 모든 Likert=3, 모든 상황문항·강제선택=1로 채운 유효 제출 payload. */
function validSubmission(
  subject: SubjectSelection,
  overrides: Partial<V2SubmissionInput> = {}
): V2SubmissionInput {
  const items = getItemsForSubject(subject);
  const responses: Record<string, number | "unknown"> = {};
  const scenarios: Record<string, number> = {};
  for (const item of items) {
    if (isLikert(item)) responses[item.id] = 3;
    else if (isChoiceItem(item)) scenarios[item.id] = 1;
  }
  return {
    intake: {
      name: "홍길동",
      school: "안산중학교",
      grade: "중2",
      subject_selection: subject,
      student_phone: "010-1111-2222",
      parent_phone: "010-3333-4444",
      profile_notice_acknowledged: true,
      ...(overrides.intake ?? {}),
    },
    responses: { ...responses, ...(overrides.responses ?? {}) },
    scenarios: { ...scenarios, ...(overrides.scenarios ?? {}) },
    supplements: overrides.supplements ?? {},
    commitment14: overrides.commitment14 ?? "틀린 문제를 어디부터 봐야 하는지 알고 싶습니다.",
    meta: overrides.meta,
  } as V2SubmissionInput;
}

describe("전화번호 정규화", () => {
  it("다양한 입력을 010-####-#### 형태로 정규화한다", () => {
    expect(normalizePhone("01011112222")).toBe("010-1111-2222");
    expect(normalizePhone("+82 10 1111 2222")).toBe("010-1111-2222");
    expect(normalizePhone("010-1111-2222")).toBe("010-1111-2222");
  });
});

describe("v2SubmissionSchema 필수 필드", () => {
  it("유효한 제출을 통과시킨다", () => {
    expect(v2SubmissionSchema.safeParse(validSubmission("math")).success).toBe(true);
  });

  it("이름이 없으면 거부한다", () => {
    const bad = validSubmission("math", { intake: { name: "" } as never });
    expect(v2SubmissionSchema.safeParse(bad).success).toBe(false);
  });

  it("전화번호 형식이 틀리면 거부한다", () => {
    const bad = validSubmission("math", { intake: { student_phone: "123" } as never });
    expect(v2SubmissionSchema.safeParse(bad).success).toBe(false);
  });

  it("입학 상담 우선 도움이 비면 거부한다", () => {
    const bad = validSubmission("math", { commitment14: "" });
    expect(v2SubmissionSchema.safeParse(bad).success).toBe(false);
  });

  it("학습 프로필 안내를 확인하지 않으면 거부한다", () => {
    const bad = validSubmission("math", { intake: { profile_notice_acknowledged: false } as never });
    expect(v2SubmissionSchema.safeParse(bad).success).toBe(false);
  });

  it("필수 Likert 문항 누락 시 거부한다", () => {
    const sub = validSubmission("math");
    delete (sub.responses as Record<string, unknown>).LA1;
    expect(v2SubmissionSchema.safeParse(sub).success).toBe(false);
  });

  it("경험 의존 문항은 경험 없음·잘 모르겠음을 허용하고 일반 문항은 허용하지 않는다", () => {
    const allowed = validSubmission("math");
    (allowed.responses as Record<string, unknown>).PH1 = "not_applicable";
    (allowed.responses as Record<string, unknown>).QI1 = "unknown";
    (allowed.responses as Record<string, unknown>).MA1 = "not_applicable";
    expect(v2SubmissionSchema.safeParse(allowed).success).toBe(true);

    const blocked = validSubmission("math");
    (blocked.responses as Record<string, unknown>).LA1 = "not_applicable";
    expect(v2SubmissionSchema.safeParse(blocked).success).toBe(false);
  });
});

describe("과목별 허용 문항 ID (서버 재계산)", () => {
  it("수학 선택에 영어 전용 문항이 오면 거부한다", () => {
    expect(v2SubmissionSchema.safeParse(validSubmission("math", { responses: { E1: 4 } })).success).toBe(false);
  });

  it("영어 선택에 수학 전용 문항이 오면 거부한다", () => {
    expect(v2SubmissionSchema.safeParse(validSubmission("english", { responses: { M1: 4 } })).success).toBe(false);
  });

  it("복합 선택은 수학·영어 문항을 모두 허용한다", () => {
    expect(v2SubmissionSchema.safeParse(validSubmission("both")).success).toBe(true);
  });
});

describe("NK 기대 최대 3개 (서버 검증)", () => {
  it("4개 이상 선택하면 거부한다", () => {
    const sub = validSubmission("math", {
      intake: { nk_expectations: ["강한 관리·명확한 기준", "철저한 숙제 관리", "클리닉·보완학습", "주간 테스트·재보완"] } as never,
    });
    expect(v2SubmissionSchema.safeParse(sub).success).toBe(false);
  });

  it("3개까지는 통과한다", () => {
    const sub = validSubmission("math", {
      intake: { nk_expectations: ["철저한 숙제 관리", "클리닉·보완학습", "주간 테스트·재보완"] } as never,
    });
    expect(v2SubmissionSchema.safeParse(sub).success).toBe(true);
  });
});

describe("이전 학원 경험 구조화 (서버 검증)", () => {
  it("최대 3개까지 저장한다", () => {
    const parsed = v2SubmissionSchema.parse(
      validSubmission("math", {
        intake: { prev_concerns: ["수준·진도 불일치", "질문·오답 피드백 부족", "숙제·복습 관리 부족"] } as never,
      }),
    );
    const score = computeScoreProfile(buildScoringInput(parsed));
    const payload = buildV2InsertPayload(parsed, score);
    expect((payload.intake_v2 as Record<string, unknown>).prev_concerns).toEqual(parsed.intake.prev_concerns);
  });

  it("4개 선택과 ‘특별한 불만 없음’의 동시 선택을 거부한다", () => {
    const tooMany = validSubmission("math", {
      intake: { prev_concerns: ["수준·진도 불일치", "설명 방식이 맞지 않음", "질문·오답 피드백 부족", "숙제·복습 관리 부족"] } as never,
    });
    expect(v2SubmissionSchema.safeParse(tooMany).success).toBe(false);
    const conflicting = validSubmission("math", {
      intake: { prev_concerns: ["특별한 불만 없음", "일정·통학 부담"] } as never,
    });
    expect(v2SubmissionSchema.safeParse(conflicting).success).toBe(false);
  });
});

describe("현재 학습의 어려운 점(과목별 선택, v2.3)", () => {
  it("최대 3개까지 통과하고 intake_v2에 저장된다", () => {
    const parsed = v2SubmissionSchema.parse(
      validSubmission("math", {
        intake: { math_difficulty_tags: ["아는데 문제에 못 씀", "서술형·증명", "시간이 모자람"] } as never,
      }),
    );
    const payload = buildV2InsertPayload(parsed, computeScoreProfile(buildScoringInput(parsed)));
    expect((payload.intake_v2 as Record<string, unknown>).math_difficulty_tags).toEqual([
      "아는데 문제에 못 씀",
      "서술형·증명",
      "시간이 모자람",
    ]);
    expect((payload.intake_v2 as Record<string, unknown>).english_difficulty_tags).toEqual([]);
  });

  it("4개 이상이나 목록에 없는 항목은 거부한다", () => {
    const four = validSubmission("math", {
      intake: { math_difficulty_tags: DIFFICULTY_TAG_OPTIONS.slice(0, 4) } as never,
    });
    expect(v2SubmissionSchema.safeParse(four).success).toBe(false);
    const unknown = validSubmission("math", { intake: { math_difficulty_tags: ["그냥 싫음"] } as never });
    expect(v2SubmissionSchema.safeParse(unknown).success).toBe(false);
  });
});

describe("MBTI 검증", () => {
  it("빈 문자열은 허용한다", () => {
    expect(v2SubmissionSchema.safeParse(validSubmission("math", { intake: { mbti: "" } as never })).success).toBe(true);
  });

  it("유효한 4글자는 대문자로 통과한다", () => {
    const r = v2SubmissionSchema.safeParse(validSubmission("math", { intake: { mbti: "enfp" } as never }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.intake.mbti).toBe("ENFP");
  });

  it("무효 문자열은 거부한다", () => {
    expect(v2SubmissionSchema.safeParse(validSubmission("math", { intake: { mbti: "XYZW" } as never })).success).toBe(false);
  });

  it("확신도 빈 문자열('미선택')은 none으로 처리한다", () => {
    const r = v2SubmissionSchema.safeParse(validSubmission("math", { intake: { mbti_confidence: "" } as never }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.intake.mbti_confidence).toBe("none");
  });
});

describe("buildScoringInput", () => {
  it("무효 MBTI는 null로 전달한다", () => {
    const parsed = v2SubmissionSchema.parse(validSubmission("math", { intake: { mbti: "" } as never }));
    expect(buildScoringInput(parsed).mbti).toBeNull();
  });

  it("직접 질문(MA5·CR5)은 상황 버킷으로 그대로 전달된다", () => {
    const parsed = v2SubmissionSchema.parse(
      validSubmission("math", { scenarios: { [MANAGEMENT_DIRECT_ID]: 4, [GUIDANCE_CHOICE_ID]: 2 } as never }),
    );
    const input = buildScoringInput(parsed);
    expect(input.scenarioResponses?.[MANAGEMENT_DIRECT_ID]).toBe(4);
    expect(input.scenarioResponses?.[GUIDANCE_CHOICE_ID]).toBe(2);
    expect(computeScoreProfile(input).verdicts?.management.verdict).toBe("지금은 어려움");
  });
});

describe("buildV2InsertPayload (필드 유실 없음)", () => {
  it("instrument_version='v2'이고 q1~q35를 채우지 않는다", () => {
    const parsed = v2SubmissionSchema.parse(validSubmission("math"));
    const score = computeScoreProfile(buildScoringInput(parsed));
    const payload = buildV2InsertPayload(parsed, score);
    expect(payload.instrument_version).toBe("v2");
    expect(payload.subject_selection).toBe("math");
    expect(payload.q1).toBeUndefined();
    expect(payload.factor_attitude).toBeUndefined();
    expect(payload.score_profile_v2).toBe(score);
  });

  it("구조화 intake 필드를 text 병합 없이 intake_v2에 보존한다", () => {
    const parsed = v2SubmissionSchema.parse(
      validSubmission("math", {
        intake: {
          prev_leave_reason: "성적 정체",
          prev_complaint: "관리가 약했다",
          referral: "친구 소개",
          referral_friend: "김철수",
          nk_expectations: ["클리닉·보완학습"],
        } as never,
      })
    );
    const score = computeScoreProfile(buildScoringInput(parsed));
    const payload = buildV2InsertPayload(parsed, score);
    const intake = payload.intake_v2 as Record<string, unknown>;
    expect(intake.prev_leave_reason).toBe("성적 정체");
    expect(intake.prev_complaint).toBe("관리가 약했다");
    expect(intake.referral).toBe("친구 소개");
    expect(intake.referral_friend).toBe("김철수");
    expect(intake.nk_expectations).toEqual(["클리닉·보완학습"]);
    expect(intake.commitment14).toBeTruthy();
    expect(payload.referral).toBe("친구 소개 (김철수)");
  });

  it("responses_v2에 raw 응답·직접 질문·리비전을 저장한다", () => {
    const parsed = v2SubmissionSchema.parse(validSubmission("math"));
    const score = computeScoreProfile(buildScoringInput(parsed));
    const payload = buildV2InsertPayload(parsed, score);
    const responses = payload.responses_v2 as Record<string, unknown>;
    expect(responses.instrument_revision).toBe(INSTRUMENT_REVISION);
    expect((responses.responses as Record<string, unknown>).LA1).toBe(3);
    expect((responses.scenarios as Record<string, unknown>)[MANAGEMENT_DIRECT_ID]).toBe(1);
    expect((responses.scenarios as Record<string, unknown>)[GUIDANCE_CHOICE_ID]).toBe(1);
  });
});

describe("폐기 문항 관용", () => {
  it("옛 저장분에 M5·LT1이 남아 있어도 제출을 막지 않는다", () => {
    const payload = validSubmission("math", { responses: { M5: 4, LT1: 4 } as never });
    expect(v2SubmissionSchema.safeParse(payload).success).toBe(true);
  });

  it("검증을 통과해도 폐기 문항은 저장 payload에 남지 않는다", () => {
    const payload = validSubmission("math", { responses: { M5: 4, LT1: 4 } as never, scenarios: { C1: 2 } as never });
    const parsed = v2SubmissionSchema.parse(payload);
    expect(parsed.responses).not.toHaveProperty("M5");
    expect(parsed.responses).not.toHaveProperty("LT1");
    expect(parsed.scenarios).not.toHaveProperty("C1");
  });

  it("폐기되지 않은 미정의 문항은 여전히 거부한다", () => {
    const payload = validSubmission("math", { responses: { ZZ9: 4 } as never });
    expect(v2SubmissionSchema.safeParse(payload).success).toBe(false);
  });
});

describe("직접 질문 제출", () => {
  it("MA5·CR5는 상황문항과 같은 버킷에 저장된다", () => {
    const parsed = v2SubmissionSchema.parse(validSubmission("math"));
    expect(parsed.scenarios[MANAGEMENT_DIRECT_ID]).toBe(1);
    expect(parsed.scenarios[GUIDANCE_CHOICE_ID]).toBe(1);
    expect(parsed.responses).not.toHaveProperty(MANAGEMENT_DIRECT_ID);
  });

  it("직접 질문 미응답이면 제출을 거부한다", () => {
    const payload = validSubmission("math");
    delete (payload.scenarios as Record<string, number>)[MANAGEMENT_DIRECT_ID];
    expect(v2SubmissionSchema.safeParse(payload).success).toBe(false);
  });

  it("선택지 범위 밖 index는 거부한다 (강제선택은 1·2뿐)", () => {
    const payload = validSubmission("math", { scenarios: { [GUIDANCE_CHOICE_ID]: 3 } as never });
    expect(v2SubmissionSchema.safeParse(payload).success).toBe(false);
  });
});
