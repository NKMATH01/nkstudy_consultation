import { describe, it, expect } from "vitest";
import { getItemsForSubject, isChoiceItem, isLikert } from "../definition";
import { computeScoreProfile } from "../scoring";
import {
  buildScoringInput,
  buildV2InsertPayload,
  expectationsToFeatures,
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
      ...(overrides.intake ?? {}),
    },
    responses: { ...responses, ...(overrides.responses ?? {}) },
    scenarios: { ...scenarios, ...(overrides.scenarios ?? {}) },
    supplements: overrides.supplements ?? {},
    commitment14: overrides.commitment14 ?? "매일 숙제 시작 시간을 지키겠습니다.",
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
    const r = v2SubmissionSchema.safeParse(validSubmission("math"));
    expect(r.success).toBe(true);
  });

  it("이름이 없으면 거부한다", () => {
    const bad = validSubmission("math", { intake: { name: "" } as never });
    const r = v2SubmissionSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("전화번호 형식이 틀리면 거부한다", () => {
    const bad = validSubmission("math", {
      intake: { student_phone: "123" } as never,
    });
    const r = v2SubmissionSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("14일 약속이 비면 거부한다", () => {
    const bad = validSubmission("math", { commitment14: "" });
    const r = v2SubmissionSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("필수 Likert 문항 누락 시 거부한다", () => {
    const sub = validSubmission("math");
    delete (sub.responses as Record<string, unknown>).LT1;
    const r = v2SubmissionSchema.safeParse(sub);
    expect(r.success).toBe(false);
  });
});

describe("과목별 허용 문항 ID (서버 재계산)", () => {
  it("수학 선택에 영어 전용 문항이 오면 거부한다", () => {
    const sub = validSubmission("math", { responses: { E1: 4 } });
    const r = v2SubmissionSchema.safeParse(sub);
    expect(r.success).toBe(false);
  });

  it("영어 선택에 수학 전용 문항이 오면 거부한다", () => {
    const sub = validSubmission("english", { responses: { M1: 4 } });
    const r = v2SubmissionSchema.safeParse(sub);
    expect(r.success).toBe(false);
  });

  it("복합 선택은 수학·영어 문항을 모두 허용한다", () => {
    const r = v2SubmissionSchema.safeParse(validSubmission("both"));
    expect(r.success).toBe(true);
  });
});

describe("NK 기대 최대 3개 (서버 검증)", () => {
  it("4개 이상 선택하면 거부한다", () => {
    const sub = validSubmission("math", {
      intake: {
        nk_expectations: [
          "강한 관리·명확한 기준",
          "철저한 숙제 관리",
          "클리닉·보완학습",
          "주간 테스트·재보완",
        ],
      } as never,
    });
    const r = v2SubmissionSchema.safeParse(sub);
    expect(r.success).toBe(false);
  });

  it("3개까지는 통과한다", () => {
    const sub = validSubmission("math", {
      intake: {
        nk_expectations: [
          "철저한 숙제 관리",
          "클리닉·보완학습",
          "주간 테스트·재보완",
        ],
      } as never,
    });
    const r = v2SubmissionSchema.safeParse(sub);
    expect(r.success).toBe(true);
  });
});

describe("MBTI 검증", () => {
  it("빈 문자열은 허용한다", () => {
    const r = v2SubmissionSchema.safeParse(
      validSubmission("math", { intake: { mbti: "" } as never })
    );
    expect(r.success).toBe(true);
  });

  it("유효한 4글자는 대문자로 통과한다", () => {
    const r = v2SubmissionSchema.safeParse(
      validSubmission("math", { intake: { mbti: "enfp" } as never })
    );
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.intake.mbti).toBe("ENFP");
  });

  it("무효 문자열은 거부한다", () => {
    const r = v2SubmissionSchema.safeParse(
      validSubmission("math", { intake: { mbti: "XYZW" } as never })
    );
    expect(r.success).toBe(false);
  });

  it("확신도 빈 문자열('미선택')은 none으로 처리한다", () => {
    const r = v2SubmissionSchema.safeParse(
      validSubmission("math", { intake: { mbti_confidence: "" } as never })
    );
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.intake.mbti_confidence).toBe("none");
  });
});

describe("expectationsToFeatures", () => {
  it("매핑 가능한 기대만 NkFeature로 변환하고 중복을 제거한다", () => {
    expect(
      expectationsToFeatures(["클리닉·보완학습", "진로·학습 상담", "철저한 숙제 관리"])
    ).toEqual(["clinic", "homework"]);
  });
});

describe("buildScoringInput", () => {
  it("무효 MBTI는 null로 전달한다", () => {
    const parsed = v2SubmissionSchema.parse(
      validSubmission("math", { intake: { mbti: "" } as never })
    );
    expect(buildScoringInput(parsed).mbti).toBeNull();
  });

  it("클리닉 참여값을 구조화 숫자로 매핑한다", () => {
    const parsed = v2SubmissionSchema.parse(
      validSubmission("math", {
        intake: { clinic_condition: "요일·시간이 맞으면 가능" } as never,
      })
    );
    expect(buildScoringInput(parsed).clinicAvailability).toBe(75);
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
    // 공용 referral 컬럼은 목록 호환용으로 합성하되 구조는 intake_v2에 유지.
    expect(payload.referral).toBe("친구 소개 (김철수)");
  });

  it("responses_v2에 raw 응답·상황·보조입력을 저장한다", () => {
    const parsed = v2SubmissionSchema.parse(
      validSubmission("math", { supplements: { phone_weekday: "1~2시간" } })
    );
    const score = computeScoreProfile(buildScoringInput(parsed));
    const payload = buildV2InsertPayload(parsed, score);
    const responses = payload.responses_v2 as Record<string, unknown>;
    expect((responses.responses as Record<string, unknown>).LT1).toBe(3);
    expect((responses.scenarios as Record<string, unknown>).C1).toBe(1);
    expect((responses.supplements as Record<string, unknown>).phone_weekday).toBe(
      "1~2시간"
    );
  });
});

// ── Phase 3 문항 1차 패키지 ──────────────────────────────────────────

describe("폐기 문항(M5) 관용", () => {
  it("옛 저장분에 M5가 남아 있어도 제출을 막지 않는다", () => {
    const payload = validSubmission("math", { responses: { M5: 4 } as never });
    const r = v2SubmissionSchema.safeParse(payload);
    expect(r.success).toBe(true);
  });

  it("검증을 통과해도 M5는 저장 payload에 남지 않는다", () => {
    const payload = validSubmission("math", { responses: { M5: 4 } as never });
    const parsed = v2SubmissionSchema.parse(payload);
    expect(parsed.responses).not.toHaveProperty("M5");

    const insert = buildV2InsertPayload(
      parsed,
      computeScoreProfile(buildScoringInput(parsed)),
    );
    const stored = (insert.responses_v2 as { responses: Record<string, unknown> }).responses;
    expect(stored).not.toHaveProperty("M5");
  });

  it("폐기되지 않은 미정의 문항은 여전히 거부한다", () => {
    const payload = validSubmission("math", { responses: { ZZ9: 4 } as never });
    const r = v2SubmissionSchema.safeParse(payload);
    expect(r.success).toBe(false);
  });
});

describe("R2 강제선택 제출", () => {
  it("R2는 상황문항과 같은 버킷에 저장된다", () => {
    const parsed = v2SubmissionSchema.parse(validSubmission("math"));
    expect(parsed.scenarios.R2).toBe(1);
    expect(parsed.responses).not.toHaveProperty("R2");
  });

  it("R2 미응답이면 제출을 거부한다", () => {
    const payload = validSubmission("math");
    delete (payload.scenarios as Record<string, number>).R2;
    const r = v2SubmissionSchema.safeParse(payload);
    expect(r.success).toBe(false);
  });

  it("선택지 범위 밖 index는 거부한다 (강제선택은 1·2뿐)", () => {
    const payload = validSubmission("math", { scenarios: { R2: 3 } as never });
    const r = v2SubmissionSchema.safeParse(payload);
    expect(r.success).toBe(false);
  });
});
