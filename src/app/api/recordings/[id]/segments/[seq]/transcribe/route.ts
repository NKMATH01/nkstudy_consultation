// POST: 조각 하나 전사(D4). 멱등 선점 — 이미 누가 하고 있거나 끝났으면 claimed:false.

import { authorizeRecording } from "@/lib/recording/guard";
import { transcribeSegment } from "@/lib/recording/service";
import { jsonError, jsonOk, parseSeq } from "@/lib/recording/http";
import { MAX_SEGMENT_SEQ } from "@/lib/recording/constants";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; seq: string }> }) {
  const { id, seq: seqRaw } = await params;
  const auth = await authorizeRecording(id, "mutate");
  if (!auth.ok) return jsonError(auth.status, auth.error);
  const seq = parseSeq(seqRaw);
  if (seq == null || seq < 1 || seq > MAX_SEGMENT_SEQ) return jsonError(400, "잘못된 부분 순번");

  const result = await transcribeSegment(auth.admin, id, seq);
  if (result.claimed && !result.ok) return jsonOk({ ...result }, 502);
  return jsonOk({ ...result });
}
