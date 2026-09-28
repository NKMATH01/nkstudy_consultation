"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Camera, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import {
  createExamAnalysis,
  searchExamConsultations,
  type ExamConsultationOption,
} from "@/lib/actions/exam-analysis";

const EXAM_PAPERS_BUCKET = "exam-papers";
const MAX_PAPER_FILES = 40;
const MAX_MATHFLEX_FILES = 2;
// exam-papers 버킷 설정(마이그레이션)과 맞춘다: 10MB, 이미지 4종.
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function extensionOf(file: File): string {
  const fromName = file.name.includes(".") ? file.name.split(".").pop() ?? "" : "";
  const fromType = file.type.startsWith("image/") ? file.type.slice(6) : "";
  const ext = (fromName || fromType).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (ext === "jpeg") return "jpg";
  return ext && ext.length <= 5 ? ext : "jpg";
}

function FilePicker({
  id,
  label,
  hint,
  files,
  max,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  files: File[];
  max: number;
  onChange: (files: File[]) => void;
  disabled: boolean;
}) {
  const add = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list).filter((f) => {
      if (!ALLOWED_TYPES.has(f.type)) {
        toast.error(`${f.name}: JPG·PNG·WEBP·HEIC 사진만 올릴 수 있습니다`);
        return false;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name}: 10MB 이하 사진만 올릴 수 있습니다`);
        return false;
      }
      return true;
    });
    const next = [...files, ...picked];
    if (next.length > max) toast.error(`최대 ${max}장까지 올릴 수 있습니다`);
    onChange(next.slice(0, max));
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-nk-ink">
        {label} <span className="text-xs font-normal text-nk-ink-hint">({files.length}/{max})</span>
      </Label>
      <p className="text-xs text-nk-ink-sub">{hint}</p>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-nk-line bg-nk-sunken px-4 py-5 text-sm text-nk-ink-sub hover:bg-nk-hover"
      >
        <Camera className="h-4 w-4" />
        사진 선택 또는 촬영
      </label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple={max > 1}
        className="sr-only"
        disabled={disabled || files.length >= max}
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between rounded-lg border border-nk-line-soft bg-nk-surface px-3 py-1.5 text-xs text-nk-ink"
            >
              <span className="truncate">
                {i + 1}. {f.name}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="ml-2 text-nk-ink-hint hover:text-nk-late"
                aria-label={`${f.name} 빼기`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function consultationLine(c: ExamConsultationOption): string {
  const date = c.consult_date ? `상담 ${c.consult_date.slice(0, 10)}` : null;
  return [c.name, c.school, c.grade, date].filter(Boolean).join(" · ");
}

export function ExamUploadClient({
  recentConsultations,
}: {
  recentConsultations: ExamConsultationOption[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [student, setStudent] = useState<ExamConsultationOption | null>(null);
  const [matches, setMatches] = useState<ExamConsultationOption[]>(recentConsultations);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);
  const [examTitle, setExamTitle] = useState("");
  const [examDate, setExamDate] = useState(todayIso);
  const [subject, setSubject] = useState("수학");
  const [note, setNote] = useState("");
  const [paperFiles, setPaperFiles] = useState<File[]>([]);
  const [mathflexFiles, setMathflexFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState("");

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return toast.error("상담 학생을 선택하세요");
    if (!examTitle.trim()) return toast.error("시험명을 입력하세요");
    if (!examDate) return toast.error("시험일을 입력하세요");
    if (!subject.trim()) return toast.error("과목을 입력하세요");
    if (paperFiles.length === 0) return toast.error("시험지 사진을 1장 이상 올려주세요");

    setSubmitting(true);
    // 행 id를 먼저 정해 두고, 그 id를 폴더명으로 Storage에 직접 올린다(서버액션 본문 크기 제한 회피).
    const examId = crypto.randomUUID();
    const supabase = createClient();
    const uploaded: string[] = [];

    const uploadAll = async (files: File[], kind: string): Promise<string[]> => {
      const paths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`${kind} ${i + 1}/${files.length} 올리는 중`);
        const path = `${examId}/${crypto.randomUUID()}.${extensionOf(file)}`;
        const { error } = await supabase.storage
          .from(EXAM_PAPERS_BUCKET)
          .upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (error) {
          console.error("[ExamAnalysis]", { action: "upload", path, error: error.message });
          throw new Error(`${file.name} 올리기에 실패했습니다`);
        }
        uploaded.push(path);
        paths.push(path);
      }
      return paths;
    };

    try {
      const paperPaths = await uploadAll(paperFiles, "시험지");
      const mathflexPaths = await uploadAll(mathflexFiles, "매쓰플랫 결과");
      setProgress("저장하는 중");

      const result = await createExamAnalysis({
        id: examId,
        consultationId: student.id,
        exam_title: examTitle.trim(),
        exam_date: examDate,
        subject: subject.trim(),
        note: note.trim() || undefined,
        paper_paths: paperPaths,
        mathflex_paths: mathflexPaths,
      });
      if (!result.success) throw new Error(result.error);

      toast.success("시험지를 올렸습니다");
      router.push(`/exams/${result.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "시험지 올리기에 실패했습니다";
      toast.error(message);
      // 행이 만들어지지 않았으니 올려 둔 사진은 치운다.
      if (uploaded.length > 0) {
        const { error } = await supabase.storage.from(EXAM_PAPERS_BUCKET).remove(uploaded);
        if (error) {
          console.error("[ExamAnalysis]", { action: "upload.cleanup", examId, error: error.message });
        }
      }
      setSubmitting(false);
      setProgress("");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/exams">
            <ArrowLeft className="h-4 w-4" />
            목록
          </Link>
        </Button>
        <h1 className="text-xl font-extrabold text-nk-ink">새 시험지 올리기</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ① 상담 학생 선택 — 신입생은 등록 전이라 상담 기록에서 고른다 */}
        <section className="space-y-3 rounded-2xl border border-nk-line bg-nk-surface p-4">
          <h2 className="text-sm font-bold text-nk-ink">① 상담 학생 선택</h2>
          {student ? (
            <div className="flex items-center justify-between rounded-xl bg-nk-navy-soft px-3 py-2 text-sm text-nk-navy-ink">
              <span className="font-bold">{consultationLine(student)}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={submitting}
                onClick={() => setStudent(null)}
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
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-nk-ink-hint" />
                )}
              </div>
              {!query.trim() && (
                <p className="text-xs text-nk-ink-hint">최근 상담 순으로 보여 줍니다.</p>
              )}
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
                          setStudent(c);
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
        </section>

        {/* ② 시험 정보 */}
        <section className="space-y-3 rounded-2xl border border-nk-line bg-nk-surface p-4">
          <h2 className="text-sm font-bold text-nk-ink">② 시험 정보</h2>
          <div className="space-y-1.5">
            <Label htmlFor="exam-title" className="text-nk-ink">시험명</Label>
            <Input
              id="exam-title"
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="예: 중2 입학테스트 A형"
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
          <div className="space-y-1.5">
            <Label htmlFor="exam-note" className="text-nk-ink">
              메모 <span className="text-xs font-normal text-nk-ink-hint">(선택)</span>
            </Label>
            <Input
              id="exam-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
            />
          </div>
        </section>

        {/* ③④ 사진 */}
        <section className="space-y-4 rounded-2xl border border-nk-line bg-nk-surface p-4">
          <div className="rounded-xl bg-nk-warn-soft px-3 py-2 text-xs text-nk-ink">
            <p className="font-bold">촬영 요령</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-nk-ink-sub">
              <li>밝은 곳에서 그림자 없이 찍어 주세요.</li>
              <li>종이가 기울지 않게 정면에서 찍어 주세요.</li>
              <li>한 면 전체가 잘리지 않고 다 나오게 찍어 주세요.</li>
            </ul>
          </div>
          <FilePicker
            id="paper-files"
            label="③ 시험지 사진"
            hint="시험지 한 면당 한 장씩, 순서대로 올려 주세요."
            files={paperFiles}
            max={MAX_PAPER_FILES}
            onChange={setPaperFiles}
            disabled={submitting}
          />
          <FilePicker
            id="mathflex-files"
            label="④ 매쓰플랫 결과보고서"
            hint="매쓰플랫 결과보고서 이미지 2장을 올려 주세요."
            files={mathflexFiles}
            max={MAX_MATHFLEX_FILES}
            onChange={setMathflexFiles}
            disabled={submitting}
          />
        </section>

        <div className="flex items-center justify-end gap-3">
          {progress && <span className="text-xs text-nk-ink-sub">{progress}</span>}
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            올리기
          </Button>
        </div>
      </form>
    </div>
  );
}
