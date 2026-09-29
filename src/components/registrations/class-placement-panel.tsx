"use client";

// 반 배정 도우미 — 등록 폼 수학 배정반 옆. 입학테스트 점수·약점 단원과 반별 진도를 한눈에 보고 "이 반으로".
// 순위 규칙은 src/lib/class-placement.ts rankClassesForStudent(신호 3개: 학년·점수대↔수준·지나간 단원∩약점).
// 요일·학생 수·담당·진도 % 는 표시만 한다.

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { getClassPlacementData } from "@/lib/actions/class-placement";
import {
  rankClassesForStudent,
  type EntranceExam,
  type LevelFit,
  type PlacementClass,
  type WeakUnitStatus,
} from "@/lib/class-placement";

interface Props {
  grade: string | null | undefined;
  exam: EntranceExam | null | undefined;
  selectedClass: string;
  onPick: (className: string) => void;
}

const FIT_TONE: Record<LevelFit, string> = {
  일치: "bg-nk-done-soft text-nk-done",
  근접: "bg-nk-progress-soft text-nk-progress",
  차이: "bg-nk-late-soft text-nk-late",
  "확인 필요": "bg-nk-sunken text-nk-ink-sub",
};

const WEAK_TONE: Record<WeakUnitStatus, string> = {
  지나감: "bg-nk-late-soft text-nk-late",
  "배우는 중": "bg-nk-progress-soft text-nk-progress",
  "확인 필요": "bg-nk-sunken text-nk-ink-sub",
};

const PREVIEW = 3;

function schedule(value: string | null): string | null {
  const v = (value ?? "").split("|").map((s) => s.trim()).filter(Boolean).join(" / ");
  return v || null;
}

export function ClassPlacementPanel({ grade, exam, selectedClass, onPick }: Props) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<PlacementClass[]>([]);

  useEffect(() => {
    let alive = true;
    getClassPlacementData()
      .then((res) => {
        if (!alive) return;
        setClasses(res.classes);
        setError(res.classes.length === 0 ? res.error : null);
      })
      .catch(() => {
        if (alive) setError("반 정보를 불러오지 못했습니다");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const ranked = useMemo(
    () =>
      rankClassesForStudent(
        { grade },
        exam ? { score: exam.score, units: exam.units } : null,
        classes
      ),
    [grade, exam, classes]
  );

  const visible = showAll ? ranked : ranked.slice(0, PREVIEW);
  const scorePercent =
    exam?.score && exam.score.max > 0 ? Math.round((exam.score.raw / exam.score.max) * 100) : null;

  return (
    <div className="rounded-lg border border-nk-line-soft bg-nk-sunken/50 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-xs font-bold text-nk-ink">
          반 배정 도우미
          <span className="ml-1.5 font-normal text-nk-ink-hint">
            {exam?.score
              ? `입학테스트 ${scorePercent}점 환산${ranked[0]?.studentLevel ? ` · 수준 ${ranked[0].studentLevel}` : ""}`
              : "입학테스트 점수 없음 — 학년·진도만 비교"}
          </span>
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-nk-ink-hint" /> : <ChevronDown className="h-3.5 w-3.5 text-nk-ink-hint" />}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {loading ? (
            <p className="flex items-center gap-1.5 text-xs text-nk-ink-hint">
              <Loader2 className="h-3 w-3 animate-spin" /> 반 정보를 불러오는 중…
            </p>
          ) : error ? (
            <p className="text-xs text-nk-late">{error}</p>
          ) : !grade ? (
            <p className="text-xs text-nk-ink-hint">학년을 먼저 고르면 같은 학년 반을 비교합니다.</p>
          ) : ranked.length === 0 ? (
            <p className="text-xs text-nk-ink-hint">{grade} 반이 없습니다.</p>
          ) : (
            <>
              {visible.map((c) => {
                const isSelected = c.className === selectedClass;
                const days = schedule(c.classDays);
                const time = schedule(c.classTime);
                const unit = [c.currentMajorUnit, c.currentMinorUnit].filter(Boolean).join(" › ");
                return (
                  <div
                    key={c.classId}
                    className={`rounded-md border bg-nk-surface p-2.5 ${isSelected ? "border-nk-progress" : "border-nk-line-soft"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-nk-ink">
                          {c.className}
                          {c.teacherName && <span className="ml-1.5 text-xs font-medium text-nk-ink-sub">{c.teacherName}</span>}
                        </p>
                        <p className="mt-0.5 text-[11px] text-nk-ink-sub">
                          {[days, time, `${c.studentCount}명`].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isSelected}
                        onClick={() => onPick(c.className)}
                        className="shrink-0 rounded-md bg-nk-progress px-2.5 py-1 text-[11px] font-bold text-nk-navy-ink disabled:opacity-50"
                      >
                        {isSelected ? "선택됨" : "이 반으로"}
                      </button>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className={`rounded px-1.5 py-0.5 font-bold ${FIT_TONE[c.levelFit]}`}>
                        수준 {c.abilityLevel ?? "미입력"} · {c.levelFit}
                      </span>
                      {c.classPace && <span className="text-nk-ink-sub">속도 {c.classPace}</span>}
                      <span className="text-nk-ink-sub">
                        진도 {c.actualPercent != null ? `${c.actualPercent}%` : "미입력"}
                        {c.expectedPercent != null && <span className="text-nk-ink-hint"> / 예상 {c.expectedPercent}%</span>}
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] text-nk-ink-sub">
                      지금 배우는 단원: {unit || <span className="text-nk-ink-hint">미입력</span>}
                      {c.mainTextbook && <span className="text-nk-ink-hint"> ({c.mainTextbook})</span>}
                    </p>

                    {c.weakChecks.length > 0 && (
                      <div className="mt-1.5">
                        <p className="text-[11px] font-semibold text-nk-ink-sub">약점 단원 대조</p>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {c.weakChecks.map((w) => (
                            <span
                              key={w.unit}
                              className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${WEAK_TONE[w.status]}`}
                              title={w.matchedWith ? `반 단원: ${w.matchedWith}` : "반 진도와 단원 이름이 맞지 않아 직접 확인이 필요합니다"}
                            >
                              {w.unit} {Math.round(w.me)}% · {w.status}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {ranked.length > PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="text-[11px] font-semibold text-nk-progress"
                >
                  {showAll ? "접기" : `다른 반 ${ranked.length - PREVIEW}개 더 보기`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
