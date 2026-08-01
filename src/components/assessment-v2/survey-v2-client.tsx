"use client";

// 설문 V2 학생 UI 오케스트레이터.
// §7 UX 규칙: 첫 화면부터 실제 설문, 점수형 한 화면 한 문항, 포인터 최초 선택 시 자동 이동,
// 키보드·기존 답 수정·보조 선택 문항은 자동 이동 예외,
// localStorage 임시 저장(제출 후 삭제) + 재방문 이어하기, response_meta 수집.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getItemsForSubject,
  isChoiceItem,
  isLikert,
  pruneToSubjectScope,
} from "@/lib/assessment/v2/definition";
import type { AssessmentItem, SubjectSelection } from "@/lib/assessment/v2/types";
import { estimateRemainingMinutes } from "@/lib/assessment/v2/survey-pace";
import { v2SubmissionSchema } from "@/lib/assessment/v2/validation";
import { submitPublicSurveyV2 } from "@/lib/actions/public-survey-v2";
import { ScoreQuestion, type ScoreValue } from "./score-question";
import {
  emptyIntake,
  INTAKE_OPTIONAL_SCREENS,
  INTAKE_SCREEN_COUNT,
  IntakeScreen,
  isIntakeScreenComplete,
  isIntakeScreenEmpty,
  type IntakeState,
} from "./intake-screens";

const STORAGE_KEY = "nk-survey-v2";
const AUTO_ADVANCE_MS = 520; // §7 460~620ms 범위.
const AUTO_ADVANCE_MS_REDUCED = 200;

/** 통과 알림을 띄우는 간격(문항). */
const MILESTONE_EVERY = 10;
const MILESTONE_TOAST_MS = 2000;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

interface ItemMeta {
  exposedAt?: number;
  firstSelectAt?: number;
  lastEditAt?: number;
}

interface PersistedState {
  intake: IntakeState;
  responses: Record<string, ScoreValue>;
  scenarios: Record<string, number>;
  supplements: Record<string, string>;
  commitment14: string;
  index: number;
}

/**
 * 저장분을 읽는다. localStorage가 원본이고, sessionStorage는 이 화면이
 * sessionStorage를 쓰던 시절에 설문을 시작한 학생의 진행분을 살리기 위한 대체 경로다.
 */
function readSaved(): Partial<PersistedState> | null {
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<PersistedState>;
  } catch {
    // 손상된 저장값은 무시하고 새로 시작한다.
    return null;
  }
}

function clearSaved() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/** 이어하기를 물어볼 만큼 진행됐는지. 이름만 적다 만 상태로 배너를 띄우지 않는다. */
function hasProgress(saved: Partial<PersistedState>): boolean {
  const answered =
    Object.keys(saved.responses ?? {}).length +
    Object.keys(saved.scenarios ?? {}).length;
  return answered > 0 || (saved.index ?? 0) > 0;
}

export function SurveyV2Client() {
  const [intake, setIntake] = useState<IntakeState>(emptyIntake);
  const [responses, setResponses] = useState<Record<string, ScoreValue>>({});
  const [scenarios, setScenarios] = useState<Record<string, number>>({});
  const [supplements, setSupplements] = useState<Record<string, string>>({});
  const [commitment14, setCommitment14] = useState("");
  const [index, setIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  /** 이어하기를 물어보는 동안 잡아 두는 저장분. 답하기 전까지 설문 화면을 렌더하지 않는다. */
  const [resume, setResume] = useState<Partial<PersistedState> | null>(null);
  /** 문항 노출→첫 선택 지연(ms). 남은 시간 추정에 쓴다. */
  const [delays, setDelays] = useState<number[]>([]);
  /** 방금 통과한 문항 수. 알림을 띄우는 동안만 값이 있다. */
  const [milestone, setMilestone] = useState<number | null>(null);

  const titleRef = useRef<HTMLHeadingElement>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemMetaRef = useRef<Record<string, ItemMeta>>({});
  const activeMsRef = useRef(0);

  const subject = intake.subject_selection as SubjectSelection | "";
  const scoreItems: AssessmentItem[] = useMemo(
    () =>
      subject === "math" || subject === "english" || subject === "both"
        ? getItemsForSubject(subject)
        : [],
    [subject]
  );
  const scoreCount = scoreItems.length;
  const commitmentIndex = INTAKE_SCREEN_COUNT + scoreCount;
  const totalScreens = commitmentIndex + 1;

  // ── phase 판정 ──
  const phase: "intake" | "score" | "commitment" =
    index < INTAKE_SCREEN_COUNT
      ? "intake"
      : index < commitmentIndex
        ? "score"
        : "commitment";
  const scoreIdx = index - INTAKE_SCREEN_COUNT;
  const currentItem = phase === "score" ? scoreItems[scoreIdx] : null;

  // ── 저장분 확인(최초 1회). 진행분이 있으면 복원하지 않고 먼저 물어본다 ──
  useEffect(() => {
    const saved = readSaved();
    if (saved && hasProgress(saved)) setResume(saved);
    setHydrated(true);
  }, []);

  const restoreSaved = useCallback(() => {
    const p = resume;
    if (!p) return;
    if (p.intake) setIntake({ ...emptyIntake(), ...p.intake });
    if (p.responses) setResponses(p.responses);
    if (p.scenarios) setScenarios(p.scenarios);
    if (p.supplements) setSupplements(p.supplements);
    if (typeof p.commitment14 === "string") setCommitment14(p.commitment14);
    if (typeof p.index === "number") setIndex(p.index);
    setResume(null);
  }, [resume]);

  const discardSaved = useCallback(() => {
    clearSaved();
    setResume(null);
  }, []);

  // ── localStorage 저장(이어하기를 묻는 중과 제출 후에는 저장하지 않음) ──
  useEffect(() => {
    if (!hydrated || submitted || resume) return;
    try {
      const payload: PersistedState = {
        intake,
        responses,
        scenarios,
        supplements,
        commitment14,
        index,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // 용량 초과 등은 무시(진행은 계속 가능).
    }
  }, [hydrated, submitted, resume, intake, responses, scenarios, supplements, commitment14, index]);

  // ── 점수형 화면 노출 시각 기록 + 제목 포커스 + active time 측정 ──
  useEffect(() => {
    if (phase !== "score" || !currentItem) return;
    const meta = (itemMetaRef.current[currentItem.id] ??= {});
    if (meta.exposedAt === undefined) meta.exposedAt = Date.now();
    // 자동 이동 후 새 문항 제목으로 포커스 이동(§7).
    titleRef.current?.focus();
    const enteredAt = Date.now();
    return () => {
      activeMsRef.current += Date.now() - enteredAt;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase, currentItem?.id]);

  // ── 언마운트 시 예약된 자동 이동 정리 ──
  useEffect(() => {
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, []);

  // ── 문항 구간 이탈 경고. 저장은 되지만 학생은 그 사실을 모른 채 닫는다 ──
  useEffect(() => {
    if (phase !== "score" || submitted) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase, submitted]);

  // ── 통과 알림 자동 닫기 ──
  useEffect(() => {
    if (milestone === null) return;
    const timer = setTimeout(() => setMilestone(null), MILESTONE_TOAST_MS);
    return () => clearTimeout(timer);
  }, [milestone]);

  const clearAutoAdvance = () => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
  };

  const isCurrentAnswered = useCallback((): boolean => {
    if (phase === "intake") return isIntakeScreenComplete(index, intake);
    if (phase === "commitment") return commitment14.trim().length > 0;
    if (!currentItem) return false;
    if (isChoiceItem(currentItem)) return scenarios[currentItem.id] !== undefined;
    const v = responses[currentItem.id];
    return v !== undefined && v !== null;
  }, [phase, index, intake, commitment14, currentItem, scenarios, responses]);

  const goNext = useCallback(() => {
    clearAutoAdvance();
    setError(null);
    setIndex((i) => Math.min(i + 1, totalScreens - 1));
  }, [totalScreens]);

  const goPrev = useCallback(() => {
    clearAutoAdvance();
    setError(null);
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  /** 이미 답한 점수형 문항 수. 진행 표시와 통과 알림에 쓴다. */
  const answeredCount = useMemo(
    () =>
      scoreItems.filter((item) =>
        isChoiceItem(item)
          ? scenarios[item.id] !== undefined
          : responses[item.id] !== undefined && responses[item.id] !== null,
      ).length,
    [scoreItems, scenarios, responses],
  );

  // ── 점수 문항 선택 처리(자동 이동 판단 포함) ──
  const handleSelect = useCallback(
    (value: ScoreValue, viaPointer: boolean) => {
      if (!currentItem) return;
      const meta = (itemMetaRef.current[currentItem.id] ??= {});
      const now = Date.now();
      const isFirstSelect = meta.firstSelectAt === undefined;
      if (isFirstSelect) meta.firstSelectAt = now;
      meta.lastEditAt = now;

      if (isFirstSelect && meta.exposedAt !== undefined) {
        setDelays((d) => [...d, Math.max(0, now - meta.exposedAt!)]);
      }

      const scenario = isChoiceItem(currentItem);
      const hadValue = scenario
        ? scenarios[currentItem.id] !== undefined
        : responses[currentItem.id] !== undefined;

      if (scenario) {
        setScenarios((s) => ({ ...s, [currentItem.id]: value as number }));
      } else {
        setResponses((s) => ({ ...s, [currentItem.id]: value }));
      }

      // 10문항마다 통과 알림. 처음 답한 문항일 때만 센다(수정은 세지 않는다).
      if (!hadValue) {
        const next = answeredCount + 1;
        if (next % MILESTONE_EVERY === 0 && next < scoreCount) setMilestone(next);
      }

      // §7 자동 이동: 포인터 최초 선택 + 보조 선택 문항 아님 + 마지막 점수 화면 아님.
      // §7 자동 이동 예외: 보조 선택 문항(P4·N4)은 보조값이 선택사항이므로 자동 이동하지 않는다.
      const hasSupplement = isLikert(currentItem) && !!currentItem.supplement;
      if (viaPointer && !hadValue && !hasSupplement) {
        const reduced =
          typeof window !== "undefined" &&
          window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        const delay = reduced ? AUTO_ADVANCE_MS_REDUCED : AUTO_ADVANCE_MS;
        clearAutoAdvance();
        autoAdvanceRef.current = setTimeout(() => {
          autoAdvanceRef.current = null;
          setIndex((i) => Math.min(i + 1, totalScreens - 1));
        }, delay);
      }
    },
    [currentItem, scenarios, responses, totalScreens, answeredCount, scoreCount]
  );

  const handleSupplementChange = useCallback((fieldId: string, value: string) => {
    setSupplements((s) => ({ ...s, [fieldId]: value }));
  }, []);

  // ── intake 변경 처리(과목 변경 시 범위 밖 응답 정리) ──
  // 과목을 바꾸면 이전 과목 문항 응답이 새 범위 밖에 남아 제출 검증이 계속 실패한다.
  const handleIntakeUpdate = useCallback(
    (patch: Partial<IntakeState>) => {
      const next = patch.subject_selection;
      const changedSubject =
        next !== undefined &&
        next !== intake.subject_selection &&
        (next === "math" || next === "english" || next === "both");

      if (!changedSubject) {
        setIntake((s) => ({ ...s, ...patch }));
        return;
      }

      const nextResponses = pruneToSubjectScope(responses, next);
      const nextScenarios = pruneToSubjectScope(scenarios, next);
      const removedCount =
        nextResponses.removed.length + nextScenarios.removed.length;

      if (
        removedCount > 0 &&
        !window.confirm(
          `과목을 바꾸면 이미 응답한 ${removedCount}개 문항이 초기화됩니다. 계속하시겠습니까?`,
        )
      ) {
        return;
      }

      setResponses(nextResponses.kept);
      setScenarios(nextScenarios.kept);
      setIntake((s) => ({ ...s, ...patch }));
    },
    [intake.subject_selection, responses, scenarios],
  );

  /** 제출 검증 실패 시 멈춰 세울 화면 인덱스. 없으면 null. */
  const findFirstIncompleteIndex = useCallback((): number | null => {
    for (let i = 0; i < INTAKE_SCREEN_COUNT; i++) {
      if (!isIntakeScreenComplete(i, intake)) return i;
    }
    const missing = scoreItems.findIndex((item) =>
      isChoiceItem(item)
        ? scenarios[item.id] === undefined
        : responses[item.id] === undefined || responses[item.id] === null,
    );
    if (missing >= 0) return INTAKE_SCREEN_COUNT + missing;
    if (!commitment14.trim()) return commitmentIndex;
    return null;
  }, [intake, scoreItems, scenarios, responses, commitment14, commitmentIndex]);

  // ── 제출 ──
  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    clearAutoAdvance();
    setError(null);

    // response_meta 구성(§8.7.5 too_fast 평가용).
    const items = itemMetaRef.current;
    const firstSelectDelays: number[] = [];
    for (const item of scoreItems) {
      const m = items[item.id];
      if (m?.exposedAt !== undefined && m.firstSelectAt !== undefined) {
        firstSelectDelays.push(Math.max(0, m.firstSelectAt - m.exposedAt));
      }
    }
    const meta = {
      activeSeconds: Math.round(activeMsRef.current / 1000),
      firstSelectDelays,
      items,
    };

    const payload = {
      intake,
      responses,
      scenarios,
      supplements,
      commitment14,
      meta,
    };

    // 클라이언트 사전 검증(서버가 다시 검증·재채점한다).
    const check = v2SubmissionSchema.safeParse(payload);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "입력을 다시 확인해주세요.");
      const target = findFirstIncompleteIndex();
      if (target !== null) setIndex(target);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitPublicSurveyV2(payload);
      if (result.success) {
        clearSaved();
        setSubmitted(true);
      } else {
        setError(result.error);
      }
    } catch {
      setError("제출 중 오류가 발생했습니다. 페이지를 새로고침(F5)한 뒤 다시 제출해주세요. 작성한 답변은 저장되어 있습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, scoreItems, intake, responses, scenarios, supplements, commitment14, findFirstIncompleteIndex]);

  // ── 완료 화면 ──
  if (submitted) {
    return (
      <div className="space-y-5 py-16 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">설문이 제출되었습니다</h2>
        <p className="mx-auto max-w-sm leading-relaxed text-muted-foreground">
          소중한 응답 감사합니다.
          <br />
          NK EDU에서 꼼꼼히 분석한 후 연락드리겠습니다.
        </p>
        <div className="pt-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            <Sparkles className="h-4 w-4" />
            NK Academy
          </span>
        </div>
      </div>
    );
  }

  // ── 이어하기 확인 ──
  // 저장분을 말없이 복원하면 학생은 자기가 어디까지 했는지 모른 채 중간 화면을 마주한다.
  if (resume) {
    return (
      <ResumeBanner
        saved={resume}
        onResume={restoreSaved}
        onRestart={discardSaved}
      />
    );
  }

  // ── 진행 표시(§7: 번호/전체/진행률만) ──
  const progressPercent = Math.round((index / (totalScreens - 1)) * 100);
  const remainingMinutes = estimateRemainingMinutes(
    delays,
    scoreCount - answeredCount,
    AUTO_ADVANCE_MS,
  );
  const progressLabel =
    phase === "score"
      ? `${scoreIdx + 1} / ${scoreCount} 문항`
      : phase === "commitment"
        ? "마무리"
        : "기본 정보 입력";

  const answered = isCurrentAnswered();
  const isCommitment = phase === "commitment";
  // 필수 입력이 없는 사전정보 화면을 비워 뒀다면 "다음" 대신 건너뛰기임을 밝힌다.
  const canSkip =
    phase === "intake" &&
    INTAKE_OPTIONAL_SCREENS.has(index) &&
    isIntakeScreenEmpty(index, intake);

  return (
    <div className="space-y-5">
      {/* 진행 표시 */}
      <div className="space-y-2">
        <StepIndicator phase={phase} />
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-foreground">
            {progressLabel}
            {phase === "score" && (
              <span className="ml-1.5 font-medium text-muted-foreground">
                · 약 {remainingMinutes}분 남음
              </span>
            )}
          </span>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
            {progressPercent}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            role="progressbar"
            aria-label="설문 진행률"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {milestone !== null && <MilestoneToast count={milestone} total={scoreCount} />}

      {/* 화면 내용 */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        {phase === "intake" && (
          <IntakeScreen
            index={index}
            state={intake}
            update={handleIntakeUpdate}
          />
        )}
        {phase === "score" && currentItem && (
          <ScoreQuestion
            key={currentItem.id}
            ref={titleRef}
            item={currentItem}
            value={
              isChoiceItem(currentItem) ? scenarios[currentItem.id] : responses[currentItem.id]
            }
            onSelect={handleSelect}
            supplements={supplements}
            onSupplementChange={handleSupplementChange}
            questionNumber={scoreIdx + 1}
            totalQuestions={scoreCount}
          />
        )}
        {isCommitment && (
          <CommitmentScreen value={commitment14} onChange={setCommitment14} />
        )}
      </div>

      {/* 오류 */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-[13px] font-medium text-destructive">
          {error}
        </div>
      )}

      {/* 내비게이션 */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={goPrev}
          disabled={index === 0 || isSubmitting}
          className="h-11 rounded-xl px-5 font-semibold"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          이전
        </Button>

        {isCommitment ? (
          <Button
            onClick={handleSubmit}
            disabled={!answered || isSubmitting}
            className="h-11 rounded-xl bg-primary px-6 font-semibold text-primary-foreground"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                제출 중...
              </>
            ) : (
              <>
                <Send className="mr-1 h-4 w-4" />
                제출하기
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={goNext}
            disabled={!answered}
            variant={canSkip ? "outline" : "default"}
            className={
              canSkip
                ? "h-11 rounded-xl px-6 font-semibold"
                : "h-11 rounded-xl bg-primary px-6 font-semibold text-primary-foreground"
            }
          >
            {canSkip ? "건너뛰기" : "다음"}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/** ① 기본 정보 → ② 문항 → ③ 마무리. 지금 어느 구간인지, 몇 구간이 남았는지 보여준다. */
function StepIndicator({ phase }: { phase: "intake" | "score" | "commitment" }) {
  const steps = ["기본 정보", "문항", "마무리"];
  const current = phase === "intake" ? 0 : phase === "score" ? 1 : 2;
  return (
    <ol className="flex items-center gap-1.5">
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={label} className="flex flex-1 items-center gap-1.5">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                state === "current"
                  ? "bg-primary text-primary-foreground"
                  : state === "done"
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {state === "done" ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span
              className={`truncate text-[11.5px] ${
                state === "current"
                  ? "font-bold text-foreground"
                  : "font-medium text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** 10문항 통과 알림. 2초 뒤 사라지며, 모션을 줄인 설정에서는 나타나는 연출을 생략한다. */
function MilestoneToast({ count, total }: { count: number; total: number }) {
  const reduced = prefersReducedMotion();
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 ${
        reduced ? "" : "animate-in fade-in slide-in-from-bottom-2 duration-300"
      }`}
    >
      <span className="rounded-full bg-foreground px-4 py-2 text-[13px] font-semibold text-background shadow-lg">
        {count}문항 통과 · {total - count}문항 남았어요
      </span>
    </div>
  );
}

/** 저장된 진행분을 이어서 할지 물어본다. */
function ResumeBanner({
  saved,
  onResume,
  onRestart,
}: {
  saved: Partial<PersistedState>;
  onResume: () => void;
  onRestart: () => void;
}) {
  const index = saved.index ?? 0;
  const where =
    index >= INTAKE_SCREEN_COUNT
      ? `${index - INTAKE_SCREEN_COUNT + 1}번 문항까지`
      : "기본 정보까지";

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div>
        <h2 className="text-[18px] font-bold text-foreground">
          이어서 하시겠어요?
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          이 기기에 {where} 저장되어 있어요. 이어서 하면 적어 둔 답이 그대로 남고,
          처음부터 하면 저장된 답은 지워집니다.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={onResume}
          className="h-11 flex-1 rounded-xl bg-primary font-semibold text-primary-foreground"
        >
          이어서 하기
        </Button>
        <Button
          variant="outline"
          onClick={onRestart}
          className="h-11 flex-1 rounded-xl font-semibold"
        >
          처음부터
        </Button>
      </div>
    </div>
  );
}

/** 마무리 화면 예시. 탭하면 입력칸에 들어가고, 그대로 고쳐 쓸 수 있다. */
const COMMITMENT_EXAMPLES = [
  "학원 오기 전 오답 1개 풀기",
  "숙제는 받은 날 첫 문제까지 풀어두기",
  "공부 시작할 때 휴대폰 가방에 넣기",
];

function CommitmentScreen({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[18px] font-bold text-foreground">첫 14일 실천 약속</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          점수가 아니라, 앞으로 2주간 스스로 지켜볼 작은 행동 하나를 적어주세요.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {COMMITMENT_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onChange(example)}
            className="min-h-[36px] rounded-full border border-border bg-muted/30 px-3.5 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {example}
          </button>
        ))}
      </div>
      <textarea
        id="v2-commitment14"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="예: 매일 학원 오기 전 수학 오답 1개를 다시 풀어보겠습니다."
        className="w-full resize-none rounded-xl border border-border bg-card px-3.5 py-2.5 text-[14px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
      />
      <p className="text-[12px] text-muted-foreground">
        예시를 눌러 넣은 뒤 자기 말로 고쳐도 됩니다. 작성한 약속은 첫 상담과 2주 뒤 확인에 활용됩니다.
      </p>
    </div>
  );
}
