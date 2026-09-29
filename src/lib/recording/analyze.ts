// 상담 분석(D5) — 전사문 전체 → gemini-3.8-flash → zod 검증 JSON.
// 화자 매칭은 여기서 한다(조각마다 전사 라벨이 바뀔 수 있음). 전사에 없는 사실은 금지.
// 로그에 전사문·분석 내용을 남기지 않는다.

import { z } from "zod";
import { extractJSON } from "@/lib/gemini";
import { ANALYZE_TIMEOUT_MS } from "@/lib/recording/constants";
import type { Utterance } from "@/lib/recording/transcribe";
import { speakerLabel } from "@/lib/recording/speaker-label";

export interface TranscriptLine extends Utterance {
  seq: number;
}

const text = z.string().max(2000);

export const consultAnalysisSchema = z.object({
  speakers: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        role: z.enum(["원장", "학부모", "학생", "기타", "불명"]),
      }),
    )
    .min(1),
  // 짧은 상담은 요약·근거가 적을 수 있다 — 하한 1(실패 반복 방지). 프롬프트는 3~5·3~6을 권한다.
  summary: z.array(text.min(1)).min(1).max(5),
  studentState: z.object({
    grades: text,
    habits: text,
    attitude: text,
  }),
  parentNeeds: z.array(text),
  parentConcerns: z.array(text),
  followUps: z.array(text),
  placementNotes: z.array(text),
  warningSignals: z.array(text),
  evidence: z
    .array(
      z.object({
        speaker: z.string().min(1).max(40),
        quote: text.min(1),
        point: text.optional(),
      }),
    )
    .min(1)
    .max(6),
});

export type ConsultAnalysis = z.infer<typeof consultAnalysisSchema>;

export function parseConsultAnalysis(raw: unknown) {
  return consultAnalysisSchema.safeParse(raw);
}

export { speakerLabel };

function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function formatTranscriptForPrompt(lines: TranscriptLine[]): string {
  return lines
    .map((l) => `[${speakerLabel(l.seq, l.speaker)} ${mmss(l.startSec)}] ${l.text}`)
    .join("\n");
}

export function buildAnalysisPrompt(lines: TranscriptLine[]): string {
  return `너는 수학 학원 신입생 상담 기록을 정리하는 도우미다. 아래는 원장·학부모·학생이 나눈 상담 녹음의 자동 전사문이다.
전사문은 10분 조각으로 나눠 전사되었고, 화자 라벨은 "S{조각번호}-{라벨}" 형식이다. 조각마다 같은 사람이 다른 라벨을 받을 수 있으니 말투·내용으로 같은 사람을 묶어 역할을 정하라.

지켜야 할 것:
- 전사문에 없는 사실·숫자·점수·날짜를 절대 만들지 마라. 언급이 없으면 "언급 없음"이라고 쓰거나 빈 배열로 둔다.
- 추측이 필요한 곳은 "추정"이라고 밝힌다.
- 핵심 요약은 3~5줄, 근거 인용(evidence)은 전사문 문장을 그대로 3~6개 발췌한다. 상담이 아주 짧으면 더 적어도 된다(최소 1개).
- 모든 값은 한국어로, 짧고 분명하게.

JSON 하나만 출력한다(설명·코드블록 금지). 형식:
{
  "speakers": [{"label": "S1-spk:0", "role": "원장|학부모|학생|기타|불명"}],
  "summary": ["핵심 요약 3~5줄"],
  "studentState": {"grades": "성적 관련", "habits": "공부 습관", "attitude": "태도"},
  "parentNeeds": ["학부모 요구"],
  "parentConcerns": ["학부모 걱정"],
  "followUps": ["상담 중 약속한 후속 조치"],
  "placementNotes": ["반 배정에 참고할 점"],
  "warningSignals": ["주의 신호(퇴원 위험·갈등·건강 등)"],
  "evidence": [{"speaker": "S1-spk:0", "quote": "원문 발췌", "point": "무엇의 근거인지"}]
}

전사문:
${formatTranscriptForPrompt(lines)}`;
}

/** 분석 호출. 실패는 throw(응답 본문은 메시지에 넣지 않는다). */
export async function callConsultAnalysis(
  lines: TranscriptLine[],
  opts: { apiKey: string; model: string; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<ConsultAnalysis> {
  if (!opts.apiKey) throw new Error("GEMINI_API_KEY 없음");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`;
  const payload = {
    contents: [{ parts: [{ text: buildAnalysisPrompt(lines) }] }],
    generationConfig: {
      temperature: 0.2,
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      // gemini.ts 주석: 3.8-flash 는 MINIMAL 을 거부, LOW 는 동작(2026-09-03 실측).
      thinkingConfig: { thinkingLevel: "LOW" },
    },
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? ANALYZE_TIMEOUT_MS);
  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new Error(aborted ? "분석 시간 초과" : "분석 요청 실패(네트워크)");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`분석 API 오류: HTTP ${res.status}`);
  const json = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  } | null;
  const out = json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!out) {
    throw new Error(
      json?.candidates?.[0]?.finishReason === "SAFETY" ? "분석이 안전 필터에 막힘" : "분석 응답이 비어 있음",
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(out);
  } catch {
    try {
      raw = extractJSON(out);
    } catch {
      throw new Error("분석 JSON 파싱 실패");
    }
  }
  const parsed = parseConsultAnalysis(raw);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).slice(0, 5).join(", ");
    throw new Error(`분석 형식 검증 실패: ${fields}`);
  }
  return parsed.data;
}
