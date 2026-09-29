// 원본 오디오 삭제(D6 만료 정리 · D7 상담 삭제 전 정리).
// 규칙: 폴더 안 실제 파일을 모두 remove 하고, 삭제된 수 == 요청 수일 때만 성공으로 본다.
// 저장소 접근은 PurgeStore 로 주입받아 단위 테스트한다.

import type { SupabaseClient } from "@supabase/supabase-js";
import { RECORDING_BUCKET } from "@/lib/recording/constants";
import { listRecordingObjects, removeObjects } from "@/lib/recording/storage";

export interface PurgeStore {
  listExpired(nowIso: string, limit: number): Promise<{ id: string }[]>;
  listObjects(recordingId: string): Promise<string[]>;
  removeObjects(paths: string[]): Promise<{ removed: number; error: string | null }>;
  markDeleted(recordingId: string, atIso: string): Promise<void>;
  markPurgeError(recordingId: string, message: string): Promise<void>;
}

export type RemoveAudioResult = { ok: true } | { ok: false; error: string };

/** 한 녹음의 오디오 파일을 전부 지운다. 일부만 지워졌으면 실패. */
export async function removeRecordingAudio(
  store: Pick<PurgeStore, "listObjects" | "removeObjects">,
  recordingId: string,
): Promise<RemoveAudioResult> {
  let paths: string[];
  try {
    paths = await store.listObjects(recordingId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "list_failed" };
  }
  if (paths.length === 0) return { ok: true };
  const result = await store.removeObjects(paths);
  if (result.error) return { ok: false, error: `remove_failed: ${result.error}` };
  if (result.removed !== paths.length) {
    return { ok: false, error: `remove_partial: ${result.removed}/${paths.length}` };
  }
  return { ok: true };
}

export async function purgeExpiredRecordings(
  store: PurgeStore,
  opts: { now: Date; limit: number },
): Promise<{ checked: number; deleted: number; failed: number }> {
  const nowIso = opts.now.toISOString();
  const expired = await store.listExpired(nowIso, opts.limit);
  let deleted = 0;
  let failed = 0;
  for (const rec of expired) {
    const r = await removeRecordingAudio(store, rec.id);
    if (r.ok) {
      await store.markDeleted(rec.id, nowIso);
      deleted++;
    } else {
      await store.markPurgeError(rec.id, r.error.slice(0, 300));
      failed++;
    }
  }
  return { checked: expired.length, deleted, failed };
}

export function createSupabasePurgeStore(admin: SupabaseClient): PurgeStore {
  return {
    async listExpired(nowIso, limit) {
      const { data, error } = await admin
        .from("consultation_recordings")
        .select("id")
        .lte("audio_delete_after", nowIso)
        .is("audio_deleted_at", null)
        .order("audio_delete_after", { ascending: true })
        .limit(limit);
      if (error) throw new Error(`list_expired_failed: ${error.message}`);
      return (data ?? []) as { id: string }[];
    },
    async listObjects(recordingId) {
      return (await listRecordingObjects(admin, recordingId)).map((o) => o.path);
    },
    removeObjects: (paths) => removeObjects(admin, paths),
    async markDeleted(recordingId, atIso) {
      const { error } = await admin
        .from("consultation_recordings")
        .update({ audio_deleted_at: atIso, purge_error: null })
        .eq("id", recordingId);
      if (error) throw new Error(`mark_deleted_failed: ${error.message}`);
      // 마감되지 않은 채 기한이 지난 녹음은 더 받을 수 없으므로 실패로 정리한다(D).
      const { error: stErr } = await admin
        .from("consultation_recordings")
        .update({ status: "failed", finalized_at: atIso, error: "원본 보관 기간이 지나 마감하지 못한 녹음입니다." })
        .eq("id", recordingId)
        .eq("status", "recording");
      if (stErr) console.error("[recording] 미마감 녹음 상태 정리 실패", { recordingId, error: stErr.message });
    },
    async markPurgeError(recordingId, message) {
      const { error } = await admin
        .from("consultation_recordings")
        .update({ purge_error: message })
        .eq("id", recordingId);
      if (error) console.error("[recording] purge_error 기록 실패", { recordingId, error: error.message });
    },
  };
}

export interface DeleteRecordingStore extends Pick<PurgeStore, "listObjects" | "removeObjects" | "markPurgeError"> {
  /** 삭제 시작 표시(status='deleting', deleting_at). 이후 업로드·완료기록·전사·분석은 거부된다. */
  markDeleting(recordingId: string): Promise<void>;
  deleteRow(recordingId: string): Promise<void>;
}

/**
 * 녹음 한 건 삭제(M·재작업2). 동의 철회·실패·빈 녹음·상담 삭제(D7) 공용.
 * ① status='deleting' 표시 → ② 파일 전부 삭제(결과 수 확인) → ③ 다시 조회해 0개 확인 → ④ 행 삭제.
 * ②·③ 에서 파일이 남으면 행을 남기고 오류(다른 탭이 늦게 올린 파일은 재시도·cron 고아 정리가 지운다).
 */
export async function deleteRecordingWithAudio(
  store: DeleteRecordingStore,
  recordingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await store.markDeleting(recordingId);
  } catch (e) {
    return { ok: false, error: `삭제 시작 표시 실패: ${e instanceof Error ? e.message : "unknown"}` };
  }
  const fail = async (reason: string) => {
    await store.markPurgeError(recordingId, reason.slice(0, 300));
    return {
      ok: false as const,
      error: "녹음 원본 파일 삭제를 확인하지 못해 녹음을 지우지 않았습니다. 잠시 뒤 다시 시도해 주세요.",
    };
  };
  const r = await removeRecordingAudio(store, recordingId);
  if (!r.ok) return fail(r.error);
  let remaining: string[];
  try {
    remaining = await store.listObjects(recordingId);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "relist_failed");
  }
  if (remaining.length > 0) return fail(`remove_recheck: ${remaining.length} left`);
  try {
    await store.deleteRow(recordingId);
  } catch (e) {
    return { ok: false, error: `녹음 기록 삭제 실패: ${e instanceof Error ? e.message : "unknown"}` };
  }
  return { ok: true };
}

export function createSupabaseDeleteStore(admin: SupabaseClient): DeleteRecordingStore {
  const base = createSupabasePurgeStore(admin);
  return {
    listObjects: base.listObjects,
    removeObjects: base.removeObjects,
    markPurgeError: base.markPurgeError,
    async markDeleting(recordingId) {
      const { error } = await admin
        .from("consultation_recordings")
        // 잠금도 함께 푼다 — 진행 중인 분석·전사 저장은 status 조건('analyzing'/'transcribing')에서 0행이 된다.
        .update({ status: "deleting", deleting_at: new Date().toISOString(), locked_at: null })
        .eq("id", recordingId);
      if (error) throw new Error(error.message);
    },
    async deleteRow(recordingId) {
      const { error } = await admin.from("consultation_recordings").delete().eq("id", recordingId);
      if (error) throw new Error(error.message);
    },
  };
}

/**
 * D7: 상담 삭제 전에 그 상담의 녹음을 모두 정리한다(한 건씩 deleteRecordingWithAudio). 하나라도 실패하면 중단.
 */
export async function deleteRecordingsForConsultation(
  admin: SupabaseClient,
  consultationId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from("consultation_recordings")
    .select("id")
    .eq("consultation_id", consultationId);
  if (error) return { ok: false, error: `녹음 목록 확인 실패: ${error.message}` };
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  const store = createSupabaseDeleteStore(admin);
  for (const id of ids) {
    const r = await deleteRecordingWithAudio(store, id);
    if (!r.ok) return r;
  }
  return { ok: true, count: ids.length };
}

// ───────────── 고아 폴더 정리(cron) ─────────────

export const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;
export const ORPHAN_PAGE_SIZE = 1000;
export const ORPHAN_MAX_PAGES = 20;

export interface OrphanStore {
  /** 버킷 최상위 폴더 이름(= 녹음 id). */
  listTopFolders(): Promise<string[]>;
  getRows(ids: string[]): Promise<{ id: string; status: string; deleting_at: string | null }[]>;
  listObjectsWithTime(folder: string): Promise<{ path: string; at: string | null }[]>;
  removeObjects(paths: string[]): Promise<{ removed: number; error: string | null }>;
  deleteRow(recordingId: string): Promise<void>;
}

function olderThan(iso: string | null, now: Date, ms: number): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return !Number.isNaN(t) && now.getTime() - t > ms;
}

/**
 * 녹음 행이 없는 폴더(마지막 파일이 24시간 넘음) 또는 'deleting' 인 채 24시간 넘은 녹음의 폴더를 지운다.
 * 이미 발급된 서명 URL 로 늦게 올라온 파일까지 결국 지워지게 한다. 한 번에 최대 limit 폴더.
 */
export async function sweepOrphanFolders(
  store: OrphanStore,
  opts: { now: Date; limit: number },
): Promise<{ swept: string[]; failed: string[] }> {
  const folders = await store.listTopFolders();
  const rows = new Map<string, { status: string; deleting_at: string | null }>();
  for (let i = 0; i < folders.length; i += 100) {
    for (const r of await store.getRows(folders.slice(i, i + 100))) rows.set(r.id, r);
  }
  const swept: string[] = [];
  const failed: string[] = [];
  let handled = 0;
  for (const folder of folders) {
    if (handled >= opts.limit) break;
    const row = rows.get(folder);
    const staleDeleting = !!row && row.status === "deleting" && olderThan(row.deleting_at, opts.now, ORPHAN_AGE_MS);
    if (row && !staleDeleting) continue;
    const objects = await store.listObjectsWithTime(folder);
    if (!row) {
      const newest = objects.reduce<string | null>((m, o) => (!m || (o.at && o.at > m) ? o.at ?? m : m), null);
      if (objects.length === 0 || !olderThan(newest, opts.now, ORPHAN_AGE_MS)) continue;
    }
    handled++;
    const paths = objects.map((o) => o.path);
    if (paths.length > 0) {
      const res = await store.removeObjects(paths);
      if (res.error || res.removed !== paths.length) {
        failed.push(folder);
        continue;
      }
      const left = await store.listObjectsWithTime(folder);
      if (left.length > 0) {
        failed.push(folder);
        continue;
      }
    }
    if (staleDeleting) {
      try {
        await store.deleteRow(folder);
      } catch {
        failed.push(folder);
        continue;
      }
    }
    swept.push(folder);
  }
  return { swept, failed };
}

export function createSupabaseOrphanStore(admin: SupabaseClient): OrphanStore {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return {
    async listTopFolders() {
      // 1,000개씩 페이지를 넘기며 모두 모은다(안전 상한 ORPHAN_MAX_PAGES 페이지).
      const names: string[] = [];
      for (let page = 0; page < ORPHAN_MAX_PAGES; page++) {
        const { data, error } = await admin.storage
          .from(RECORDING_BUCKET)
          .list("", { limit: ORPHAN_PAGE_SIZE, offset: page * ORPHAN_PAGE_SIZE });
        if (error) throw new Error(`list_top_failed: ${error.message}`);
        const rows = data ?? [];
        names.push(...rows.filter((o) => o.id === null && UUID_RE.test(o.name)).map((o) => o.name));
        if (rows.length < ORPHAN_PAGE_SIZE) break;
      }
      return names;
    },
    async getRows(ids) {
      if (ids.length === 0) return [];
      const { data, error } = await admin
        .from("consultation_recordings")
        .select("id, status, deleting_at")
        .in("id", ids);
      if (error) throw new Error(`rows_failed: ${error.message}`);
      return (data ?? []) as { id: string; status: string; deleting_at: string | null }[];
    },
    async listObjectsWithTime(folder) {
      const { data, error } = await admin.storage.from(RECORDING_BUCKET).list(folder, { limit: 1000 });
      if (error) throw new Error(`list_failed: ${error.message}`);
      return (data ?? [])
        .filter((o) => o.id !== null)
        .map((o) => ({ path: `${folder}/${o.name}`, at: o.updated_at ?? o.created_at ?? null }));
    },
    removeObjects: (paths) => removeObjects(admin, paths),
    async deleteRow(recordingId) {
      const { error } = await admin
        .from("consultation_recordings")
        .delete()
        .eq("id", recordingId)
        .eq("status", "deleting");
      if (error) throw new Error(error.message);
    },
  };
}
