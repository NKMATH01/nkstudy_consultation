// 녹음 마감 계획(A) — 순수 함수.
// 발급만 되고 완료 기록이 없는 조각(pending):
//   - 파일이 Storage 에 있으면 uploaded 로 올린다.
//   - 파일이 없으면 아직 어느 기기에 남아 있을 수 있으므로 마감을 거부한다.
//     사용자가 확인창에서 "그 조각 없이 마감"을 고른 경우(discardMissing)에만 행을 지운다.

export type FinalizePlan =
  | { ok: true; markUploaded: { id: string; size: number }[]; deleteIds: string[] }
  | { ok: false; markUploaded: { id: string; size: number }[]; missingSeqs: number[] };

export function planFinalize(
  pending: { id: string; seq: number; path: string }[],
  objects: { path: string; size: number }[],
  opts: { discardMissing: boolean },
): FinalizePlan {
  const markUploaded: { id: string; size: number }[] = [];
  const missing: { id: string; seq: number }[] = [];
  for (const p of pending) {
    const obj = objects.find((o) => o.path === p.path);
    if (obj && obj.size > 0) markUploaded.push({ id: p.id, size: obj.size });
    else missing.push({ id: p.id, seq: p.seq });
  }
  if (missing.length > 0 && !opts.discardMissing) {
    return { ok: false, markUploaded, missingSeqs: missing.map((m) => m.seq).sort((a, b) => a - b) };
  }
  return { ok: true, markUploaded, deleteIds: missing.map((m) => m.id) };
}
