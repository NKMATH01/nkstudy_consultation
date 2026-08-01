import { describe, expect, it } from "vitest";
import { buildReportHTML, type ReportTemplateData } from "@/lib/claude";

function makeTemplateData(): ReportTemplateData {
  return {
    profileVersion: "v1",
    name: "테스트학생",
    school: "테스트중",
    grade: "중2",
    studentPhone: "010-1111-2222",
    parentPhone: "010-3333-4444",
    registrationDate: "2026-08-01",
    assignedClass: "중2-M1",
    teacher: "김선생",
    subject: "수학",
    preferredDays: "주말 집중",
    useVehicle: "미사용",
    location: "1",
    tuitionFee: 350000,
    page1: {
      docNo: "",
      deptLabel: "",
      profileSummary: "요약",
      managementGuide: [{ title: "관리 포인트", description: "매주 점검" }],
      actionChecklist: ["숙제 확인", "출결 확인"],
    },
    page2: {
      welcomeTitle: "환영합니다",
      welcomeSubtitle: "함께 시작해요",
      expertDiagnosis: "진단",
      focusPoints: [],
      parentMessage: "학부모님께 드리는 안내입니다.",
    },
  };
}

describe("등록안내문 학부모/강사 분리(P1-C)", () => {
  it("parent(기본) HTML에는 내부 관리 섹션이 없다", () => {
    const html = buildReportHTML(makeTemplateData());

    expect(html).not.toContain("매니지먼트");
    expect(html).not.toContain("필수 점검");
    // 담임 관리 섹션(관리 포인트) 자체가 통째로 빠진다
    expect(html).not.toContain("관리 포인트");
    // 학부모용 헤더/연락처는 그대로 유지
    expect(html).toContain("010-3333-4444");
  });

  it("audience를 명시하지 않으면 parent와 동일한 출력이다(하위호환)", () => {
    const data = makeTemplateData();
    expect(buildReportHTML(data)).toBe(buildReportHTML(data, "parent"));
  });

  it("teacher HTML에는 학생/학부모 연락처가 없고 관리 섹션만 담긴다", () => {
    const html = buildReportHTML(makeTemplateData(), "teacher");

    expect(html).not.toContain("010-1111-2222");
    expect(html).not.toContain("010-3333-4444");
    expect(html).toContain("매니지먼트");
    expect(html).toContain("필수 점검");
    expect(html).toContain("관리 포인트");
  });
});
