// 전사 어댑터(D4) — Gemini Interactions API(gemini-3.5-transcribe).
// 요청 만들기·응답 파싱은 순수 함수로 분리했다. 호출은 callTranscribe 한 곳에서만 한다.
// 형식 근거: 팀장 실측(2026-09-29, 합성 한국어 2인 대화) — 인라인 base64(data) 입력,
//   응답 steps[].content[] 의 {type:"text", text, annotations:[{type:"word_info", text, speaker:"spk:0",
//   start_offset:"0.400s", end_offset:"0.800s"}]}. status 가 completed 가 아니면 실패.
// Files API 는 쓰지 않는다(구글에 48시간 사본이 남음). 로그에 전사문을 남기지 않는다.

import { TRANSCRIBE_TIMEOUT_MS } from "@/lib/recording/constants";
import { baseMime } from "@/lib/recording/storage";

export const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

export interface Utterance {
  speaker: string;
  startSec: number;
  endSec: number;
  text: string;
}

export function buildTranscribeRequest(input: { model: string; base64: string; mimeType: string }) {
  return {
    model: input.model,
    input: [{ type: "audio", data: input.base64, mime_type: baseMime(input.mimeType) }],
    generation_config: {
      transcription_config: {
        language_codes: ["ko-KR"],
        mode: { type: "verbatim", diarization_mode: "speaker", timestamp_granularities: ["word"] },
      },
    },
  };
}

/** "0.400s" → 0.4. 형식이 틀리면 null. */
export function parseOffsetSec(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d+(?:\.\d+)?)s?$/);
  if (!m) return null;
  return Number(m[1]);
}

type ParseResult = { ok: true; utterances: Utterance[] } | { ok: false; error: string };

interface WordInfo {
  text: string;
  speaker: string;
  start: number | null;
  end: number | null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** word_info 를 화자가 바뀔 때마다 한 덩어리로 묶는다. */
export function groupWordsBySpeaker(words: WordInfo[]): Utterance[] {
  const out: Utterance[] = [];
  for (const w of words) {
    const text = w.text.trim();
    if (!text) continue;
    const last = out[out.length - 1];
    if (last && last.speaker === w.speaker) {
      last.text = `${last.text} ${text}`;
      if (w.end != null) last.endSec = round3(w.end);
    } else {
      out.push({
        speaker: w.speaker,
        startSec: round3(w.start ?? w.end ?? last?.endSec ?? 0),
        endSec: round3(w.end ?? w.start ?? last?.endSec ?? 0),
        text,
      });
    }
  }
  return out;
}

export function parseTranscribeResponse(json: unknown): ParseResult {
  const root = asRecord(json);
  if (!root) return { ok: false, error: "응답 형식 오류(객체 아님)" };
  if (root.status !== "completed") {
    return { ok: false, error: `전사 상태가 완료가 아님: ${String(root.status ?? "없음").slice(0, 40)}` };
  }
  const steps = Array.isArray(root.steps) ? root.steps : [];
  const words: WordInfo[] = [];
  const plainTexts: string[] = [];
  for (const step of steps) {
    const s = asRecord(step);
    if (!s || !Array.isArray(s.content)) continue;
    for (const c of s.content) {
      const part = asRecord(c);
      if (!part || part.type !== "text") continue;
      const annotations = Array.isArray(part.annotations) ? part.annotations : [];
      const wordInfos = annotations
        .map(asRecord)
        .filter((a): a is Record<string, unknown> => !!a && a.type === "word_info" && typeof a.text === "string");
      if (wordInfos.length > 0) {
        for (const a of wordInfos) {
          words.push({
            text: String(a.text),
            speaker: typeof a.speaker === "string" && a.speaker ? a.speaker : "unknown",
            start: parseOffsetSec(a.start_offset),
            end: parseOffsetSec(a.end_offset),
          });
        }
      } else if (typeof part.text === "string" && part.text.trim()) {
        plainTexts.push(part.text.trim());
      }
    }
  }
  if (words.length > 0) return { ok: true, utterances: groupWordsBySpeaker(words) };
  if (plainTexts.length > 0) {
    return { ok: true, utterances: [{ speaker: "unknown", startSec: 0, endSec: 0, text: plainTexts.join(" ") }] };
  }
  const outputText = typeof root.output_text === "string" ? root.output_text.trim() : "";
  if (outputText) return { ok: true, utterances: [{ speaker: "unknown", startSec: 0, endSec: 0, text: outputText }] };
  return { ok: false, error: "전사 결과가 비어 있음" };
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
}

/** 전사 호출. 실패는 throw(메시지에 응답 본문을 넣지 않는다 — 전사문 유출 방지). */
export async function callTranscribe(
  input: { audio: Uint8Array; mimeType: string },
  opts: { apiKey: string; model: string; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<Utterance[]> {
  if (!opts.apiKey) throw new Error("GEMINI_API_KEY 없음");
  const body = buildTranscribeRequest({ model: opts.model, base64: toBase64(input.audio), mimeType: input.mimeType });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? TRANSCRIBE_TIMEOUT_MS);
  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(INTERACTIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new Error(aborted ? "전사 시간 초과(240초)" : "전사 요청 실패(네트워크)");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`전사 API 오류: HTTP ${res.status}`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("전사 응답 JSON 파싱 실패");
  }
  const parsed = parseTranscribeResponse(json);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.utterances;
}
