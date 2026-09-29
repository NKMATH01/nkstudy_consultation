// 브라우저 IndexedDB 에 녹음 파트(10초 단위)를 쌓아 두는 저장소(D2).
// 키: 사용자|녹음|순번|파트번호. 업로드와 서버 기록 확인 뒤에만 지운다.

const DB_NAME = "nk-consult-recorder";
const STORE = "parts";
const DB_VERSION = 1;

export interface PartRecord {
  key: string;
  userKey: string;
  recordingId: string;
  seq: number;
  idx: number;
  mime: string;
  blob: Blob;
  savedAt: number;
}

export function partKey(userKey: string, recordingId: string, seq: number, idx: number): string {
  return `${userKey}|${recordingId}|${String(seq).padStart(3, "0")}|${String(idx).padStart(5, "0")}`;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB 를 쓸 수 없는 브라우저입니다."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error("IndexedDB 열기 실패"));
    };
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB 오류"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB 중단"));
  });
}

export async function putPart(rec: PartRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(rec);
  await done(tx);
}

export async function listParts(userKey: string): Promise<PartRecord[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const req = tx.objectStore(STORE).getAll();
  const all = await new Promise<PartRecord[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result ?? []) as PartRecord[]);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB 읽기 실패"));
  });
  return all.filter((p) => p.userKey === userKey).sort((a, b) => a.key.localeCompare(b.key));
}

/** L: 사용자와 무관하게 오래된(기본 3일) 파트를 지운다. 그 사이 복구하지 않은 것은 버린 것으로 본다. */
export async function purgeOldParts(maxAgeMs: number, now = Date.now()): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const req = tx.objectStore(STORE).getAll();
  const all = await new Promise<PartRecord[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result ?? []) as PartRecord[]);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB 읽기 실패"));
  });
  const old = all.filter((p) => !(now - p.savedAt <= maxAgeMs)).map((p) => p.key);
  await deleteParts(old);
  return old.length;
}

export async function deleteParts(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  for (const k of keys) store.delete(k);
  await done(tx);
}

export interface LocalSegmentGroup {
  recordingId: string;
  seq: number;
  parts: PartRecord[];
}

export function groupParts(parts: PartRecord[]): LocalSegmentGroup[] {
  const map = new Map<string, LocalSegmentGroup>();
  for (const p of parts) {
    const k = `${p.recordingId}|${p.seq}`;
    const g = map.get(k) ?? { recordingId: p.recordingId, seq: p.seq, parts: [] };
    g.parts.push(p);
    map.set(k, g);
  }
  return [...map.values()]
    .map((g) => ({ ...g, parts: g.parts.sort((a, b) => a.idx - b.idx) }))
    .sort((a, b) => (a.recordingId === b.recordingId ? a.seq - b.seq : a.recordingId.localeCompare(b.recordingId)));
}
