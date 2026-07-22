import { describe, expect, it } from "vitest";
import {
  escapeLikePattern,
  nextStudentDisplayName,
  normalizeIdentityPhone,
  selectConsultationIdentity,
  selectSurveyConsultation,
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

  it("이름보다 분석 ID를 우선해 동명이인의 상담을 고른다", () => {
    expect(
      selectSurveyConsultation(consultations, {
        name: "김지민",
        parentPhone: "010-1111-1111",
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
