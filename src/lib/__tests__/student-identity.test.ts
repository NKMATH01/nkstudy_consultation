import { describe, expect, it } from "vitest";
import {
  escapeLikePattern,
  nextStudentDisplayName,
  normalizeIdentityPhone,
  selectConsultationIdentity,
  selectSurveyConsultation,
  selectSurveyConsultations,
  selectUniqueSurveyConsultation,
  selectStudentIdentity,
  type ConsultationIdentityRecord,
  type StudentIdentityRecord,
} from "../student-identity";

const students: StudentIdentityRecord[] = [
  {
    id: "old",
    name: "김지민",
    phone: "010-1111-1111",
    parent_phone: "010-2222-8971",
  },
  {
    id: "new",
    name: "김지민(2)",
    phone: "010-3333-1402",
    parent_phone: "010-3333-1402",
  },
  {
    id: "sibling",
    name: "김지후",
    phone: "010-4444-8910",
    parent_phone: "010-3333-1402",
  },
];

describe("student identity matching", () => {
  it("이름이 같아도 연락처가 다르면 기존 학생을 덮어쓰지 않는다", () => {
    expect(
      selectStudentIdentity(students.slice(0, 1), {
        name: "김지민",
        studentPhone: "010-3333-1402",
        parentPhone: "010-3333-1402",
      }),
    ).toEqual({ kind: "new" });
  });

  it("숫자 접미사가 붙은 학생도 연락처가 같으면 같은 학생으로 찾는다", () => {
    const selection = selectStudentIdentity(students, {
      name: "김지민",
      studentPhone: "+82 10 3333 1402",
      parentPhone: "01033331402",
    });
    expect(selection.kind).toBe("existing");
    if (selection.kind === "existing") expect(selection.record.id).toBe("new");
  });

  it("부모 연락처가 같은 형제는 이름이 다르면 매칭하지 않는다", () => {
    expect(
      selectStudentIdentity([students[2]], {
        name: "김지민",
        parentPhone: "010-3333-1402",
      }),
    ).toEqual({ kind: "new" });
  });

  it("연락처가 없으면 이름만으로 자동 갱신하지 않는다", () => {
    expect(selectStudentIdentity(students, { name: "김지민" })).toEqual({ kind: "new" });
  });

  it("연락처까지 같은 행이 여러 개면 모호함으로 중단한다", () => {
    const selection = selectStudentIdentity(
      [students[0], { ...students[0], id: "duplicate", name: "김지민(3)" }],
      { name: "김지민", parentPhone: "010-2222-8971" },
    );
    expect(selection.kind).toBe("ambiguous");
  });
});

describe("student display name", () => {
  it("동명이인의 비어 있는 다음 숫자 접미사를 사용한다", () => {
    expect(
      nextStudentDisplayName("김지민", [
        { name: "김지민" },
        { name: "김지민(2)" },
        { name: "김지민(4)" },
        { name: "김지민(김지후동생)" },
      ]),
    ).toBe("김지민(3)");
  });

  it("기본 이름이 비어 있으면 접미사 없이 기본 이름을 쓴다", () => {
    expect(nextStudentDisplayName("김지민", [{ name: "김지민(2)" }])).toBe("김지민");
  });
});

describe("consultation identity matching", () => {
  const consultations: ConsultationIdentityRecord[] = [
    {
      id: "old-consultation",
      name: "김지민",
      parent_phone: "010-2222-8971",
      registration_id: null,
    },
    {
      id: "new-consultation",
      name: "김지민(김지후동생)",
      parent_phone: "010-3333-1402",
      registration_id: null,
    },
  ];

  it("이름 주석이 있어도 부모 연락처가 같은 신규 상담을 고른다", () => {
    const selection = selectConsultationIdentity(consultations, {
      name: "김지민",
      parentPhone: "010-3333-1402",
    });
    expect(selection.kind).toBe("existing");
    if (selection.kind === "existing") expect(selection.record.id).toBe("new-consultation");
  });

  it("이름만 같은 기존 상담의 연락처가 다르면 선택하지 않는다", () => {
    expect(
      selectConsultationIdentity(consultations.slice(0, 1), {
        name: "김지민",
        parentPhone: "010-3333-1402",
      }),
    ).toEqual({ kind: "new" });
  });
});

// candidates는 호출자가 최신 상담을 앞에 두고 넘긴다는 규약을 전제로 한다.
describe("survey consultation matching", () => {
  const consultations = [
    {
      id: "other-person",
      name: "김지민",
      parent_phone: "010-1111-1111",
      analysis_id: "analysis-old",
    },
    {
      id: "target-person",
      name: "김지민(2)",
      parent_phone: "+82 10-3333-1402",
      analysis_id: "analysis-new",
    },
  ];

  it("동명이인은 분석 ID와 연락처가 함께 가리키는 상담을 고른다", () => {
    expect(
      selectSurveyConsultation(consultations, {
        name: "김지민",
        parentPhone: "01033331402",
        analysisId: "analysis-new",
      })?.id,
    ).toBe("target-person");
  });

  it("분석 연결이 없으면 정규화한 학부모 연락처로 찾는다", () => {
    expect(
      selectSurveyConsultation(consultations, {
        name: "김지민",
        parentPhone: "01033331402",
      })?.id,
    ).toBe("target-person");
  });

  it("강한 식별자가 불일치하면 이름만 같은 최신 상담으로 후퇴하지 않는다", () => {
    expect(
      selectSurveyConsultation(consultations, {
        name: "김지민",
        analysisId: "missing-analysis",
      }),
    ).toBeNull();
  });

  it("동명이인 이름 fallback을 명시적으로 차단할 수 있다", () => {
    expect(
      selectSurveyConsultation(
        consultations,
        { name: "김지민" },
        { allowNameFallback: false },
      ),
    ).toBeNull();
  });

  // 재상담 시나리오: 같은 학생이 몇 달 뒤 다시 상담해 새 상담 행이 생겼고,
  // 옛 분석은 여전히 옛 상담에 스탬프돼 있다. 화면 상태는 최신 상담을 따라야 한다.
  describe("재상담(같은 학생의 상담 다건)", () => {
    const reConsultations = [
      {
        id: "recent-consultation",
        name: "박서준",
        parent_phone: "010-2222-3333",
        analysis_id: null,
      },
      {
        id: "old-consultation",
        name: "박서준",
        parent_phone: "010-2222-3333",
        analysis_id: "analysis-1",
      },
    ];

    it("옛 상담에 분석이 스탬프돼 있어도 더 최신 상담을 고른다", () => {
      expect(
        selectSurveyConsultation(reConsultations, {
          name: "박서준",
          parentPhone: "010-2222-3333",
          analysisId: "analysis-1",
        })?.id,
      ).toBe("recent-consultation");
    });

    it("연락처만 주어져도 최신 상담을 고른다", () => {
      expect(
        selectSurveyConsultation(reConsultations, {
          name: "박서준",
          parentPhone: "01022223333",
        })?.id,
      ).toBe("recent-consultation");
    });

    it("최신 상담에 이미 새 분석이 연결돼 있으면 그 상담을 고른다", () => {
      const withNewAnalysis = [
        { ...reConsultations[0], analysis_id: "analysis-2" },
        reConsultations[1],
      ];
      expect(
        selectSurveyConsultation(withNewAnalysis, {
          name: "박서준",
          parentPhone: "010-2222-3333",
          analysisId: "analysis-1",
        })?.id,
      ).toBe("recent-consultation");
    });
  });

  // 알려진 한계: 연락처와 분석 ID가 서로 다른 사람을 가리키는 모순된 식별자를 받으면
  // 두 건 모두 강한 일치로 잡혀 목록 앞(최신) 쪽이 선택된다.
  // 실제 호출자는 한 설문에서 이름·연락처·분석 ID를 함께 뽑아 넘기므로 이 조합은 나오지 않는다.
  it("연락처와 분석 ID가 서로 다른 사람을 가리키면 목록 앞선 상담을 고른다", () => {
    expect(
      selectSurveyConsultation(consultations, {
        name: "김지민",
        parentPhone: "010-1111-1111",
        analysisId: "analysis-new",
      })?.id,
    ).toBe("other-person");
  });
});

// 화면에서 상담을 날짜로 고르려면 매칭 전부가 필요하다.
describe("survey consultation matching (복수 반환)", () => {
  const reConsultations = [
    {
      id: "recent-consultation",
      name: "박서준",
      parent_phone: "010-2222-3333",
      analysis_id: null,
    },
    {
      id: "middle-consultation",
      name: "박서준",
      parent_phone: "+82 10-2222-3333",
      analysis_id: null,
    },
    {
      id: "old-consultation",
      name: "박서준",
      parent_phone: "010-2222-3333",
      analysis_id: "analysis-1",
    },
    {
      id: "other-person",
      name: "박서준(2)",
      parent_phone: "010-9999-9999",
      analysis_id: null,
    },
  ];

  it("매칭 상담을 호출자 정렬 순서(최신순) 그대로 모두 반환한다", () => {
    expect(
      selectSurveyConsultations(reConsultations, {
        name: "박서준",
        parentPhone: "010-2222-3333",
        analysisId: "analysis-1",
      }).map((c) => c.id),
    ).toEqual(["recent-consultation", "middle-consultation", "old-consultation"]);
  });

  it("단수 버전은 복수 결과의 첫 원소와 일치한다", () => {
    const identity = { name: "박서준", parentPhone: "010-2222-3333" };
    expect(selectSurveyConsultation(reConsultations, identity)?.id).toBe(
      selectSurveyConsultations(reConsultations, identity)[0]?.id,
    );
  });

  it("강한 식별자가 있는데 매칭이 없으면 빈 배열을 반환한다", () => {
    expect(
      selectSurveyConsultations(reConsultations, {
        name: "박서준",
        parentPhone: "010-0000-0000",
      }),
    ).toEqual([]);
  });

  it("식별자가 없고 fallback이 허용되면 이름이 같은 상담을 모두 반환한다", () => {
    expect(
      selectSurveyConsultations(reConsultations, { name: "박서준" }).map((c) => c.id),
    ).toEqual([
      "recent-consultation",
      "middle-consultation",
      "old-consultation",
      "other-person",
    ]);
  });

  it("fallback을 차단하면 빈 배열을 반환한다", () => {
    expect(
      selectSurveyConsultations(
        reConsultations,
        { name: "박서준" },
        { allowNameFallback: false },
      ),
    ).toEqual([]);
  });
});

describe("unique survey consultation matching", () => {
  const consultations = [
    {
      id: "target",
      name: "김지민",
      parent_phone: "+82 10-3333-1402",
      analysis_id: null,
    },
    {
      id: "other",
      name: "김지민(2)",
      parent_phone: "010-9999-9999",
      analysis_id: "analysis-other",
    },
  ];

  it("정규화된 학부모 연락처의 유일 매칭을 반환한다", () => {
    expect(
      selectUniqueSurveyConsultation(consultations, {
        name: "김지민",
        parentPhone: "01033331402",
      })?.id,
    ).toBe("target");
  });

  it("분석 ID의 유일 매칭도 반환한다", () => {
    expect(
      selectUniqueSurveyConsultation(consultations, {
        name: "김지민",
        analysisId: "analysis-other",
      })?.id,
    ).toBe("other");
  });

  it("강한 식별자에 두 건 이상 일치하면 반환하지 않는다", () => {
    expect(
      selectUniqueSurveyConsultation(
        [consultations[0], { ...consultations[0], id: "duplicate" }],
        { name: "김지민", parentPhone: "010-3333-1402" },
      ),
    ).toBeNull();
  });

  it("강한 식별자가 일치하지 않으면 반환하지 않는다", () => {
    expect(
      selectUniqueSurveyConsultation(consultations, {
        name: "김지민",
        parentPhone: "010-0000-0000",
      }),
    ).toBeNull();
  });

  it("강한 식별자 없이 이름만 같아도 폴백하지 않는다", () => {
    expect(
      selectUniqueSurveyConsultation(consultations, { name: "김지민" }),
    ).toBeNull();
  });
});

describe("identity utilities", () => {
  it("국가번호 전화번호를 비교 가능한 숫자로 정규화한다", () => {
    expect(normalizeIdentityPhone("+82 10-3333-1402")).toBe("01033331402");
  });

  it("LIKE 와일드카드를 이스케이프한다", () => {
    expect(escapeLikePattern("김_지%민\\")).toBe("김\\_지\\%민\\\\");
  });
});
