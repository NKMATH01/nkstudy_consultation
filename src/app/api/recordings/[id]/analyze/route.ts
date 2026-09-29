// POST: 녹음 분석(D5). 마감 + 모든 조각 전사 완료일 때만 선점해서 실행.

import { authorizeRecording } from "@/lib/recording/guard";
import { analyzeRecording } from "@/lib/recording/service";
import { jsonError, jsonOk } from "@/lib/recording/http";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorizeRecording(id, "mutate");
  if (!auth.ok) return jsonError(auth.status, auth.error);
  const result = await analyzeRecording(auth.admin, id);
  if (result.claimed && !result.ok) return jsonOk({ ...result }, 502);
  return jsonOk({ ...result });
}
