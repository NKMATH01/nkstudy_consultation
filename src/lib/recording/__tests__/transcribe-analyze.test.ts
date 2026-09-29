import { describe, expect, it, vi } from "vitest";
import {
  buildTranscribeRequest,
  callTranscribe,
  parseOffsetSec,
  parseTranscribeResponse,
} from "@/lib/recording/transcribe";
import { buildAnalysisPrompt, parseConsultAnalysis } from "@/lib/recording/analyze";

// 팀장 실측(2026-09-29, 합성 2인 대화) 응답 모양을 줄인 픽스처. 내용은 합성 문장.
const TEXT = "안녕하세요, 반갑습니다. 네 안녕하세요.";
const FIXTURE = {
  id: "int-1",
  status: "completed",
  object: "interaction",
  model: "gemini-3.5-transcribe",
  steps: [
    {
      type: "model_output",
      content: [
        {
          type: "text",
          text: TEXT,
          annotations: [
            { type: "word_info", start_index: 0, end_index: 6, text: "안녕하세요,", start_offset: "0.400s", end_offset: "0.800s", speaker: "spk:0" },
            { type: "word_info", start_index: 7, end_index: 13, text: "반갑습니다.", start_offset: "0.900s", end_offset: "1.500s", speaker: "spk:0" },
            { type: "word_info", start_index: 14, end_index: 15, text: "네", start_offset: "2.100s", end_offset: "2.300s", speaker: "spk:1" },
            { type: "word_info", start_index: 16, end_index: 22, text: "안녕하세요.", start_offset: "2.300s", end_offset: "2.900s", speaker: "spk:1" },
          ],
        },
      ],
    },
  ],
};

describe("transcribe adapter (Interactions API)", () => {
  it("buildTranscribeRequest_inlineBase64", () => {
    const body = buildTranscribeRequest({ model: "gemini-3.5-transcribe", base64: "QUJD", mimeType: "audio/webm;codecs=opus" });
    expect(body).toEqual({
      model: "gemini-3.5-transcribe",
      input: [{ type: "audio", data: "QUJD", mime_type: "audio/webm" }],
      generation_config: {
        transcription_config: {
          language_codes: ["ko-KR"],
          mode: { type: "verbatim", diarization_mode: "speaker", timestamp_granularities: ["word"] },
        },
      },
    });
  });

  it("parseOffsetSec", () => {
    expect(parseOffsetSec("0.400s")).toBeCloseTo(0.4);
    expect(parseOffsetSec("12s")).toBe(12);
    expect(parseOffsetSec(undefined)).toBeNull();
    expect(parseOffsetSec("abc")).toBeNull();
  });

  it("parseTranscribe_groupsBySpeakerChange", () => {
    const r = parseTranscribeResponse(FIXTURE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.utterances).toEqual([
      { speaker: "spk:0", startSec: 0.4, endSec: 1.5, text: "안녕하세요, 반갑습니다." },
      { speaker: "spk:1", startSec: 2.1, endSec: 2.9, text: "네 안녕하세요." },
    ]);
  });

  it("parseTranscribe_noAnnotations_singleChunk", () => {
    const r = parseTranscribeResponse({
      status: "completed",
      steps: [{ type: "model_output", content: [{ type: "text", text: "전체 문장" }] }],
    });
    expect(r).toEqual({ ok: true, utterances: [{ speaker: "unknown", startSec: 0, endSec: 0, text: "전체 문장" }] });
  });

  it("parseTranscribe_notCompleted_fails", () => {
    expect(parseTranscribeResponse({ ...FIXTURE, status: "failed" }).ok).toBe(false);
    expect(parseTranscribeResponse(null).ok).toBe(false);
    expect(parseTranscribeResponse({ status: "completed", steps: [] }).ok).toBe(false);
  });

  it("callTranscribe_usesInteractionsEndpointWithMock", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(FIXTURE), { status: 200 }));
    const r = await callTranscribe(
      { audio: new Uint8Array([1, 2, 3]), mimeType: "audio/webm" },
      { fetchImpl: fetchImpl as unknown as typeof fetch, apiKey: "k", model: "gemini-3.5-transcribe" },
    );
    expect(r.length).toBe(2);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("k");
    expect(JSON.parse(String(init.body)).input[0].data).toBe("AQID");
  });

  it("callTranscribe_httpError_throwsWithoutBodyLeak", async () => {
    const fetchImpl = vi.fn(async () => new Response("secret transcript", { status: 400 }));
    await expect(
      callTranscribe(
        { audio: new Uint8Array([1]), mimeType: "audio/webm" },
        { fetchImpl: fetchImpl as unknown as typeof fetch, apiKey: "k", model: "m" },
      ),
    ).rejects.toThrow(/400/);
  });
});

const VALID_ANALYSIS = {
  speakers: [{ label: "S1-spk:0", role: "원장" }],
  summary: ["요약1", "요약2", "요약3"],
  studentState: { grades: "", habits: "", attitude: "" },
  parentNeeds: [],
  parentConcerns: [],
  followUps: [],
  placementNotes: [],
  warningSignals: [],
  evidence: [
    { speaker: "S1-spk:0", quote: "a" },
    { speaker: "S1-spk:0", quote: "b" },
    { speaker: "S1-spk:0", quote: "c" },
  ],
};

describe("analysis schema (D5)", () => {
  it("analysis_schema_rejectsMissingFields", () => {
    expect(parseConsultAnalysis(VALID_ANALYSIS).success).toBe(true);
    const { summary: _s, ...noSummary } = VALID_ANALYSIS;
    void _s;
    expect(parseConsultAnalysis(noSummary).success).toBe(false);
    const { evidence: _e, ...noEvidence } = VALID_ANALYSIS;
    void _e;
    expect(parseConsultAnalysis(noEvidence).success).toBe(false);
    expect(parseConsultAnalysis({ ...VALID_ANALYSIS, summary: [] }).success).toBe(false);
    expect(parseConsultAnalysis({ ...VALID_ANALYSIS, summary: ["1", "2", "3", "4", "5", "6"] }).success).toBe(false);
    expect(parseConsultAnalysis({ ...VALID_ANALYSIS, evidence: [] }).success).toBe(false);
  });

  it("analysis_prompt_forbidsInventedFacts", () => {
    const p = buildAnalysisPrompt([{ seq: 1, speaker: "spk:0", startSec: 0, endSec: 1, text: "x" }]);
    expect(p).toContain("전사문에 없는");
    expect(p).toContain("S1-spk:0");
  });
});
