import { describe, expect, it } from "vitest";
import { selectConsultationAnalysisStampTarget } from "../consultation-analysis";

describe("consultation analysis stamping selection", () => {
  const survey = { name: "김지민", parent_phone: "010-3333-1402" };

  it("analysis_id가 비어 있는 유일 상담만 갱신 대상으로 고른다", () => {
    const target = selectConsultationAnalysisStampTarget(
      [
        {
          id: "target",
          name: "김지민",
          parent_phone: "+82 10-3333-1402",
          analysis_id: null,
        },
      ],
      survey,
    );
    expect(target?.id).toBe("target");
  });

  it("이미 analysis_id가 있으면 갱신 대상으로 고르지 않는다", () => {
    expect(
      selectConsultationAnalysisStampTarget(
        [
          {
            id: "linked",
            name: "김지민",
            parent_phone: "01033331402",
            analysis_id: "analysis-existing",
          },
        ],
        survey,
      ),
    ).toBeNull();
  });

  it("동일 식별자가 여러 건이면 갱신 대상으로 고르지 않는다", () => {
    expect(
      selectConsultationAnalysisStampTarget(
        [
          {
            id: "one",
            name: "김지민",
            parent_phone: "01033331402",
            analysis_id: null,
          },
          {
            id: "two",
            name: "김지민(2)",
            parent_phone: "010-3333-1402",
            analysis_id: null,
          },
        ],
        survey,
      ),
    ).toBeNull();
  });
});
