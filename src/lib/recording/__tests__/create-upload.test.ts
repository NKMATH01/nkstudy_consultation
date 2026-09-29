import { describe, expect, it } from "vitest";
import { buildRecordingInsert } from "@/lib/recording/create";
import { validateUploadRequest } from "@/lib/recording/upload";
import { segmentPath } from "@/lib/recording/storage";

const LIVE = { audioDeleteAfter: "2099-01-01T00:00:00.000Z", audioDeletedAt: null, now: new Date("2026-09-29T00:00:00.000Z") };

describe("buildRecordingInsert (D6)", () => {
  it("deleteAfter_setAtInsert", () => {
    const now = new Date("2026-09-29T01:00:00.000Z");
    const row = buildRecordingInsert({
      consultationId: "c-1",
      mime: "audio/webm;codecs=opus",
      consentVersion: "v1",
      staffLabel: "teacher:p-1",
      now,
    });
    expect(row.created_at).toBe("2026-09-29T01:00:00.000Z");
    expect(row.audio_delete_after).toBe("2026-10-29T01:00:00.000Z");
    expect(row.consent_at).toBe(row.created_at);
    expect(row.status).toBe("recording");
    expect(row.mime).toBe("audio/webm");
  });
});

describe("validateUploadRequest (D3)", () => {
  it("uploadUrl_rejectsSeqAbove72_andDuplicate", () => {
    expect(validateUploadRequest({ ...LIVE, seq: 73, recordingStatus: "recording", existing: null }).ok).toBe(false);
    expect(validateUploadRequest({ ...LIVE, seq: 0, recordingStatus: "recording", existing: null }).ok).toBe(false);
    expect(validateUploadRequest({ ...LIVE, seq: 1.5, recordingStatus: "recording", existing: null }).ok).toBe(false);
    expect(validateUploadRequest({ ...LIVE, seq: 72, recordingStatus: "recording", existing: null }).ok).toBe(true);
    // 이미 올라간 순번은 거부
    expect(
      validateUploadRequest({ ...LIVE, seq: 3, recordingStatus: "recording", existing: { status: "uploaded" } }).ok,
    ).toBe(false);
    expect(
      validateUploadRequest({ ...LIVE, seq: 3, recordingStatus: "recording", existing: { status: "transcribed" } }).ok,
    ).toBe(false);
    // 발급만 되고 올라가지 않은 순번은 다시 발급 가능
    expect(
      validateUploadRequest({ ...LIVE, seq: 3, recordingStatus: "recording", existing: { status: "pending" } }).ok,
    ).toBe(true);
    // 녹음이 끝난 뒤에는 발급하지 않는다
    expect(validateUploadRequest({ ...LIVE, seq: 2, recordingStatus: "transcribing", existing: null }).ok).toBe(false);
  });

  it("segmentPath_serverBuilt", () => {
    expect(segmentPath("rec-1", 7, "audio/webm")).toBe("rec-1/seg-007.webm");
    expect(segmentPath("rec-1", 12, "audio/mp4")).toBe("rec-1/seg-012.m4a");
  });
});
