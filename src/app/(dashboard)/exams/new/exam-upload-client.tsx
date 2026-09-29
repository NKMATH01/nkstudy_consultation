"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileText,
  ImagePlus,
  Loader2,
  Pencil,
  RotateCw,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import {
  createExamAnalysis,
  searchExamConsultations,
  type ExamConsultationOption,
} from "@/lib/actions/exam-analysis";
import type { ExamUploadKind } from "@/lib/exam-alimtalk";

const EXAM_PAPERS_BUCKET = "exam-papers";
const MAX_PAPER_FILES = 40;
const MAX_MATHFLEX_FILES = 2;
// exam-papers 버킷 설정(마이그레이션 20260928100000·20260929110000)과 맞춘다.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};
const PDF_TYPE = "application/pdf";

type UploadStatus = "ready" | "uploading" | "done" | "error";

interface UploadItem {
  key: string;
  kind: ExamUploadKind;
  file: File;
  previewUrl: string | null;
  status: UploadStatus;
  progress: number;
  path: string | null;
  error: string | null;
}

function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function defaultTitle(student: ExamConsultationOption | null): string {
  const grade = student?.grade?.trim();
  return grade ? `${grade} 입학테스트` : "입학테스트";
}

function extensionFor(file: File): string | null {
  if (file.type === PDF_TYPE) return "pdf";
  return IMAGE_EXT[file.type] ?? null;
}

function consultationLine(c: ExamConsultationOption): string {
  const date = c.consult_date ? `상담 ${c.consult_date.slice(0, 10)}` : null;
  return [c.name, c.school, c.grade, date].filter(Boolean).join(" · ");
}

function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`;
}

/**
 * 브라우저 → Storage 직접 업로드(서버액션 본문 1MB 제한 회피). supabase-js 는 진행률을 주지 않아
 * 같은 REST 엔드포인트를 XHR 로 부른다. 권한은 로그인 세션 토큰 + authenticated storage 정책 그대로.
 */
function uploadWithProgress(
  accessToken: string,
  path: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/storage/v1/object/${EXAM_PAPERS_BUCKET}/${encoded}`);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("네트워크 오류"));
    xhr.send(file);
  });
}

function Thumb({ item }: { item: UploadItem }) {
  const [broken, setBroken] = useState(false);
  if (item.file.type === PDF_TYPE || !item.previewUrl || broken) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-nk-sunken text-nk-ink-sub">
        <FileText className="h-6 w-6" />
        <span className="text-[10px] font-bold">{item.file.type === PDF_TYPE ? "PDF" : "사진"}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 로컬 미리보기(blob URL)라 next/image 대상이 아니다
    <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-cover" onError={() => setBroken(true)} />
  );
}

function DropZone({
  kind,
  title,
  hint,
  accept,
  max,
  items,
  busy,
  onAdd,
  onRemove,
}: {
  kind: ExamUploadKind;
  title: string;
  hint: string;
  accept: string;
  max: number;
  items: UploadItem[];
  busy: boolean;
  onAdd: (kind: ExamUploadKind, files: FileList | File[]) => void;
  onRemove: (key: string) => void;
}) {
  const [over, setOver] = useState(false);
  const full = items.length >= max;
  const pickId = `${kind}-pick`;
  const cameraId = `${kind}-camera`;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-nk-line bg-nk-surface p-4">
      <div>
        <h2 className="text-sm font-bold text-nk-ink">
          {title} <span className="text-xs font-normal text-nk-ink-hint">({items.length}/{max})</span>
        </h2>
        <p className="mt-0.5 text-xs text-nk-ink-sub">{hint}</p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy && !full) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!busy && !full) onAdd(kind, e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-center text-xs text-nk-ink-sub transition-colors ${
          over ? "border-nk-progress bg-nk-progress-soft" : "border-nk-line bg-nk-sunken"
        }`}
      >
        <p>여기로 끌어다 놓거나</p>
        <div className="flex flex-wrap justify-center gap-2">
          <label
            htmlFor={pickId}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-nk-line bg-nk-surface px-3 py-1.5 text-xs font-bold text-nk-ink hover:bg-nk-hover ${
              busy || full ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            파일 선택
          </label>
          <label
            htmlFor={cameraId}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-nk-line bg-nk-surface px-3 py-1.5 text-xs font-bold text-nk-ink hover:bg-nk-hover ${
              busy || full ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            카메라로 찍기
          </label>
        </div>
        <input
          id={pickId}
          type="file"
          accept={accept}
          multiple={max > 1}
          className="sr-only"
          disabled={busy || full}
          onChange={(e) => {
            if (e.target.files) onAdd(kind, e.target.files);
            e.target.value = "";
          }}
        />
        <input
          id={cameraId}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={busy || full}
          onChange={(e) => {
            if (e.target.files) onAdd(kind, e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((item, i) => (
            <li
              key={item.key}
              className={`relative overflow-hidden rounded-lg border ${
                item.status === "error" ? "border-nk-late" : "border-nk-line-soft"
              } bg-nk-surface`}
            >
              <div className="aspect-[3/4]">
                <Thumb item={item} />
              </div>
              <span className="absolute left-1 top-1 rounded bg-nk-surface px-1.5 text-[10px] font-bold text-nk-ink">
                {i + 1}
              </span>
              {item.status !== "uploading" && item.status !== "done" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemove(item.key)}
                  className="absolute right-1 top-1 rounded-full bg-nk-surface p-0.5 text-nk-ink-sub hover:text-nk-late disabled:opacity-50"
                  aria-label={`${item.file.name} 빼기`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <div className="space-y-1 px-1.5 py-1">
                <p className="truncate text-[10px] text-nk-ink" title={item.file.name}>
                  {item.file.name}
                </p>
                <div className="flex items-center gap-1 text-[10px]">
                  {item.status === "done" ? (
                    <span className="inline-flex items-center gap-0.5 font-bold text-nk-done">
                      <CheckCircle2 className="h-3 w-3" /> 완료
                    </span>
                  ) : item.status === "error" ? (
                    <span className="inline-flex items-center gap-0.5 font-bold text-nk-late">
                      <AlertCircle className="h-3 w-3" /> 실패
                    </span>
                  ) : (
                    <span className="text-nk-ink-hint">{formatBytes(item.file.size)}</span>
                  )}
                </div>
                {(item.status === "uploading" || item.status === "done") && (
                  <div className="h-1 overflow-hidden rounded-full bg-nk-sunken">
                    <div
                      className={`h-full ${item.status === "done" ? "bg-nk-done" : "bg-nk-progress"}`}
                      style={{ width: `${item.status === "done" ? 100 : item.progress}%` }}
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ExamUploadClient({
  recentConsultations,
  initialStudent = null,
}: {
  recentConsultations: ExamConsultationOption[];
  initialStudent?: ExamConsultationOption | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [student, setStudent] = useState<ExamConsultationOption | null>(initialStudent);
  const [matches, setMatches] = useState<ExamConsultationOption[]>(recentConsultations);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  const [examTitle, setExamTitle] = useState(() => defaultTitle(initialStudent));
  const [titleTouched, setTitleTouched] = useState(false);
  const [examDate, setExamDate] = useState(todayIso);
  const [subject, setSubject] = useState("수학");
  const [infoOpen, setInfoOpen] = useState(false);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);

  // 한 화면에서 올리는 동안 같은 시험 id(=Storage 폴더)를 유지해, 실패한 파일만 다시 올릴 수 있게 한다.
  const [examId] = useState(() => crypto.randomUUID());
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState("");

  // 페이지를 떠날 때 미리보기 blob URL 정리.
  useEffect(() => {
    return () => {
      for (const it of itemsRef.current) if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
    };
  }, []);

  const chooseStudent = (c: ExamConsultationOption | null) => {
    setStudent(c);
    if (!titleTouched) setExamTitle(defaultTitle(c));
  };

  // 입력이 멈추면(250ms) 서버에서 상담 기록을 검색한다. 늦게 도착한 옛 응답은 버린다.
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = value.trim();
    const seq = ++searchSeq.current;
    if (!q) {
      setMatches(recentConsultations);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const result = await searchExamConsultations(q);
        if (seq === searchSeq.current) setMatches(result);
      } catch (err) {
        console.error("[ExamAnalysis]", {
          action: "searchConsultations.client",
          error: err instanceof Error ? err.message : String(err),
        });
        // 이전 검색 결과가 남아 있으면 엉뚱한 학생을 고를 수 있다. 비우고 알린다.
        if (seq === searchSeq.current) {
          setMatches([]);
          toast.error("상담 학생 검색에 실패했습니다. 잠시 뒤 다시 입력해 주세요.");
        }
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 250);
  };

  const addFiles = (kind: ExamUploadKind, list: FileList | File[]) => {
    const max = kind === "paper" ? MAX_PAPER_FILES : MAX_MATHFLEX_FILES;
    const current = items.filter((it) => it.kind === kind).length;
    const accepted: UploadItem[] = [];
    for (const file of Array.from(list)) {
      const isPdf = file.type === PDF_TYPE;
      if (isPdf && kind !== "mathflex") {
        toast.error(`${file.name}: 시험지는 사진만 올릴 수 있습니다`);
        continue;
      }
      if (!isPdf && !IMAGE_EXT[file.type]) {
        toast.error(
          `${file.name}: ${kind === "mathflex" ? "PDF 또는 " : ""}JPG·PNG·WEBP·HEIC 사진만 올릴 수 있습니다`,
        );
        continue;
      }
      const limit = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
      if (file.size > limit) {
        toast.error(`${file.name}: ${isPdf ? "PDF 는 20MB" : "사진은 10MB"} 이하만 올릴 수 있습니다`);
        continue;
      }
      if (current + accepted.length >= max) {
        toast.error(`최대 ${max}개까지 올릴 수 있습니다`);
        break;
      }
      accepted.push({
        key: crypto.randomUUID(),
        kind,
        file,
        previewUrl: isPdf ? null : URL.createObjectURL(file),
        status: "ready",
        progress: 0,
        path: null,
        error: null,
      });
    }
    if (accepted.length > 0) setItems((prev) => [...prev, ...accepted]);
  };

  const removeItem = (key: string) => {
    setItems((prev) => {
      const target = prev.find((it) => it.key === key);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((it) => it.key !== key);
    });
  };

  const patchItem = (key: string, patch: Partial<UploadItem>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const paperItems = items.filter((it) => it.kind === "paper");
  const mathflexItems = items.filter((it) => it.kind === "mathflex");
  const failedCount = items.filter((it) => it.status === "error").length;

  const handleSubmit = async () => {
    if (!student) return toast.error("상담 학생을 선택하세요");
    if (!examTitle.trim()) {
      setInfoOpen(true);
      return toast.error("시험명을 입력하세요");
    }
    if (!examDate) {
      setInfoOpen(true);
      return toast.error("시험일을 입력하세요");
    }
    if (!subject.trim()) {
      setInfoOpen(true);
      return toast.error("과목을 입력하세요");
    }
    if (paperItems.length === 0) return toast.error("시험지 사진을 1장 이상 올려주세요");

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;
      if (!accessToken) throw new Error("로그인이 만료되었습니다. 다시 로그인해 주세요.");

      // 이미 올라간 파일은 건너뛰고, 대기·실패 파일만 올린다(한 번에 2개씩).
      const snapshot = items;
      const pending = snapshot.filter((it) => it.status !== "done");
      setStage(`${pending.length}개 올리는 중`);
      const uploadedPaths = new Map<string, string>();
      let failed = 0;
      const queue = [...pending];
      const worker = async () => {
        for (let it = queue.shift(); it; it = queue.shift()) {
          const ext = extensionFor(it.file);
          if (!ext) {
            failed++;
            patchItem(it.key, { status: "error", error: "형식 오류" });
            continue;
          }
          // 재시도 때마다 새 이름 — 앞선 시도가 서버에 남았어도 덮어쓰기 충돌이 나지 않는다.
          const path = `${examId}/${crypto.randomUUID()}.${ext}`;
          const key = it.key;
          patchItem(key, { status: "uploading", progress: 0, error: null });
          try {
            await uploadWithProgress(accessToken, path, it.file, (p) => patchItem(key, { progress: p }));
            uploadedPaths.set(key, path);
            patchItem(key, { status: "done", progress: 100, path });
          } catch (err) {
            failed++;
            const message = err instanceof Error ? err.message : String(err);
            console.error("[ExamAnalysis]", { action: "upload", path, error: message });
            patchItem(key, { status: "error", error: message });
          }
        }
      };
      await Promise.all([worker(), worker()]);

      if (failed > 0) {
        toast.error(`${failed}개 파일을 올리지 못했습니다. "올리기"를 다시 누르면 실패한 파일만 다시 올립니다.`);
        return;
      }

      const pathOf = (it: UploadItem) => it.path ?? uploadedPaths.get(it.key) ?? "";
      const latest = snapshot;
      setStage("저장하는 중");
      const paperPaths = latest.filter((it) => it.kind === "paper").map(pathOf);
      const mathflexPaths = latest.filter((it) => it.kind === "mathflex").map(pathOf);
      let result: Awaited<ReturnType<typeof createExamAnalysis>>;
      try {
        result = await createExamAnalysis({
          id: examId,
          consultationId: student.id,
          exam_title: examTitle.trim(),
          exam_date: examDate,
          subject: subject.trim(),
          note: note.trim() || undefined,
          paper_paths: paperPaths,
          mathflex_paths: mathflexPaths,
        });
      } catch (err) {
        result = { success: false, error: err instanceof Error ? err.message : "시험지 등록 중 오류가 발생했습니다" };
      }
      if (!result.success) {
        // 행이 만들어지지 않았으니 올려 둔 파일은 치운다(재시도용 보존은 개별 파일 업로드 실패 때만).
        // 다음 "올리기" 는 모든 파일을 처음부터 다시 올린다.
        const uploaded = [...paperPaths, ...mathflexPaths].filter(Boolean);
        if (uploaded.length > 0) {
          const { error } = await supabase.storage.from(EXAM_PAPERS_BUCKET).remove(uploaded);
          if (error) {
            console.error("[ExamAnalysis]", { action: "upload.cleanup", examId, error: error.message });
          }
        }
        setItems((prev) => prev.map((it) => ({ ...it, status: "ready", progress: 0, path: null, error: null })));
        throw new Error(result.error);
      }

      toast.success("시험지를 올렸습니다");
      router.push(`/exams/${result.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "시험지 올리기에 실패했습니다");
    } finally {
      setSubmitting(false);
      setStage("");
    }
  };

  const infoSummary = [examTitle.trim() || "(시험명 없음)", examDate, subject.trim() || "(과목 없음)"].join(" · ");

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/exams">
            <ArrowLeft className="h-4 w-4" />
            목록
          </Link>
        </Button>
        <h1 className="text-xl font-extrabold text-nk-ink">입학테스트 올리기</h1>
      </div>

      {/* 학생 + 시험 정보 */}
      <section className="space-y-3 rounded-2xl border border-nk-line bg-nk-surface p-4">
        {student ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-nk-line bg-nk-navy-soft px-3 py-2 text-sm text-nk-navy">
            {/* 옅은 바탕(navy-soft) 위라 글자는 navy. navy-ink 는 진한 navy-strong 바탕 전용(흰 글자). */}
            <span className="font-bold text-nk-ink">{consultationLine(student)}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="font-bold text-nk-navy hover:bg-nk-surface hover:text-nk-ink"
              disabled={submitting}
              onClick={() => chooseStudent(null)}
            >
              바꾸기
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-nk-ink-hint" />
              <Input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="상담 학생 이름 또는 학교로 검색"
                className="pl-9"
                aria-label="상담 학생 검색"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-nk-ink-hint" />
              )}
            </div>
            {!query.trim() && <p className="text-xs text-nk-ink-hint">최근 상담 순으로 보여 줍니다.</p>}
            <ul className="max-h-60 overflow-y-auto rounded-xl border border-nk-line-soft">
              {matches.length === 0 ? (
                <li className="px-3 py-2 text-xs text-nk-ink-hint">
                  {searching ? "검색 중입니다" : "검색 결과가 없습니다"}
                </li>
              ) : (
                matches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        chooseStudent(c);
                        handleQueryChange("");
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-nk-ink hover:bg-nk-hover"
                    >
                      {consultationLine(c)}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </>
        )}

        {!infoOpen ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-nk-ink">{infoSummary}</span>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" disabled={submitting} onClick={() => setInfoOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />
                수정
              </Button>
              {!noteOpen && (
                <Button type="button" variant="ghost" size="sm" disabled={submitting} onClick={() => setNoteOpen(true)}>
                  메모 추가
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="exam-title" className="text-nk-ink">시험명</Label>
              <Input
                id="exam-title"
                value={examTitle}
                onChange={(e) => {
                  setExamTitle(e.target.value);
                  setTitleTouched(true);
                }}
                disabled={submitting}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="exam-date" className="text-nk-ink">시험일</Label>
                <Input
                  id="exam-date"
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exam-subject" className="text-nk-ink">과목</Label>
                <Input
                  id="exam-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="flex justify-end gap-1">
              {!noteOpen && (
                <Button type="button" variant="ghost" size="sm" disabled={submitting} onClick={() => setNoteOpen(true)}>
                  메모 추가
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setInfoOpen(false)}>
                접기
              </Button>
            </div>
          </div>
        )}

        {noteOpen && (
          <div className="space-y-1.5">
            <Label htmlFor="exam-note" className="text-nk-ink">
              메모 <span className="text-xs font-normal text-nk-ink-hint">(선택)</span>
            </Label>
            <Input id="exam-note" value={note} onChange={(e) => setNote(e.target.value)} disabled={submitting} />
          </div>
        )}
      </section>

      <div className="rounded-xl bg-nk-warn-soft px-3 py-2 text-xs text-nk-ink">
        <span className="font-bold">촬영 요령</span>
        <span className="text-nk-ink-sub"> · 밝은 곳에서 그림자 없이 · 정면에서 기울지 않게 · 한 면 전체가 다 나오게</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DropZone
          kind="paper"
          title="시험지 사진"
          hint="한 면당 한 장씩, 순서대로 올려 주세요. (사진 10MB 이하)"
          accept="image/*"
          max={MAX_PAPER_FILES}
          items={paperItems}
          busy={submitting}
          onAdd={addFiles}
          onRemove={removeItem}
        />
        <DropZone
          kind="mathflex"
          title="매쓰플랫 결과지"
          hint="PDF 그대로(20MB 이하) 또는 사진(10MB 이하), 최대 2개."
          accept={`${PDF_TYPE},image/*`}
          max={MAX_MATHFLEX_FILES}
          items={mathflexItems}
          busy={submitting}
          onAdd={addFiles}
          onRemove={removeItem}
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        {stage ? (
          <span className="text-xs text-nk-ink-sub">{stage}</span>
        ) : failedCount > 0 ? (
          <span className="text-xs font-bold text-nk-late">실패 {failedCount}개 — 다시 누르면 실패한 파일만 올립니다</span>
        ) : null}
        <Button type="button" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : failedCount > 0 ? <RotateCw className="h-4 w-4" /> : null}
          올리기
        </Button>
      </div>
    </div>
  );
}
