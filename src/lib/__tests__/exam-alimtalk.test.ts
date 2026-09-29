import { describe, expect, it } from "vitest";
import {
  EXAM_REPORT_TEMPLATE_CODE,
  buildExamReportVars,
  extendReportExpiry,
  isValidExamUploadPath,
  reportTokenSendBlock,
} from "../exam-alimtalk";

const EXAM_ID = "11111111-2222-4333-8444-555555555555";
const FILE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("buildExamReportVars", () => {
  it("이름·시험일·토큰을 템플릿 변수로 만든다", () => {
    expect(EXAM_REPORT_TEMPLATE_CODE).toBe("exam_report");
    expect(
      buildExamReportVars({ student_name: "박서진", exam_date: "2026-09-28" }, "tok-1"),
    ).toEqual({ 이름: "박서진", 시험일: "2026. 9. 28(월)", 토큰: "tok-1" });
  });

  it("토큰이 없으면 throw 한다", () => {
    expect(() => buildExamReportVars({ student_name: "박서진", exam_date: "2026-09-28" }, null)).toThrow();
    expect(() => buildExamReportVars({ student_name: "박서진", exam_date: "2026-09-28" }, "  ")).toThrow();
  });

  it("시험일이 비면 '-' 로 채운다", () => {
    expect(buildExamReportVars({ student_name: "박서진", exam_date: null }, "t").시험일).toBe("-");
  });
});

describe("extendReportExpiry", () => {
  const now = new Date("2026-09-29T00:00:00.000Z");

  it("만료가 14일보다 가까우면 now+14일로 늘린다", () => {
    expect(extendReportExpiry("2026-10-01T00:00:00.000Z", now)).toBe("2026-10-13T00:00:00.000Z");
  });

  it("이미 지난 만료도 now+14일로 늘린다", () => {
    expect(extendReportExpiry("2026-09-01T00:00:00.000Z", now)).toBe("2026-10-13T00:00:00.000Z");
  });

  it("이미 더 길면 그대로 둔다", () => {
    expect(extendReportExpiry("2026-12-31T00:00:00.000Z", now)).toBe("2026-12-31T00:00:00.000Z");
  });

  it("만료 없음(null)은 그대로 null", () => {
    expect(extendReportExpiry(null, now)).toBeNull();
  });
});

describe("reportTokenSendBlock", () => {
  it("revoked 면 거부 사유를 돌려준다", () => {
    expect(reportTokenSendBlock({ revoked_at: "2026-09-20T00:00:00Z" })).toMatch(/끊긴/);
  });
  it("행이 없으면 거부한다", () => {
    expect(reportTokenSendBlock(null)).not.toBeNull();
  });
  it("살아 있으면 null", () => {
    expect(reportTokenSendBlock({ revoked_at: null })).toBeNull();
  });
});

describe("isValidExamUploadPath", () => {
  it("사진은 시험지·매쓰플랫 모두 허용", () => {
    expect(isValidExamUploadPath(EXAM_ID, `${EXAM_ID}/${FILE_ID}.jpg`, "paper")).toBe(true);
    expect(isValidExamUploadPath(EXAM_ID, `${EXAM_ID}/${FILE_ID}.heic`, "mathflex")).toBe(true);
  });
  it("pdf 는 매쓰플랫만 허용", () => {
    expect(isValidExamUploadPath(EXAM_ID, `${EXAM_ID}/${FILE_ID}.pdf`, "mathflex")).toBe(true);
    expect(isValidExamUploadPath(EXAM_ID, `${EXAM_ID}/${FILE_ID}.pdf`, "paper")).toBe(false);
  });
  it("다른 시험 폴더·이상한 이름은 거부", () => {
    expect(isValidExamUploadPath(EXAM_ID, `${FILE_ID}/${FILE_ID}.jpg`, "paper")).toBe(false);
    expect(isValidExamUploadPath(EXAM_ID, `${EXAM_ID}/../x.jpg`, "paper")).toBe(false);
    expect(isValidExamUploadPath(EXAM_ID, `${EXAM_ID}/${FILE_ID}.exe`, "mathflex")).toBe(false);
  });
});
