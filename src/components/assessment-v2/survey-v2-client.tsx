"use client";

// 설문 V2 학생 UI 오케스트레이터.
// §7 UX 규칙: 첫 화면부터 실제 설문, 점수형 한 화면 한 문항, 포인터 최초 선택 시 자동 이동,
// 키보드·기존 답 수정·보조 선택 문항은 자동 이동 예외, 진행 표시는 번호/전체/진행률만,
// sessionStorage 임시 저장(제출 후 삭제), response_meta 수집.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getItemsForSubject,
  isChoiceItem,
  isLikert,
  pruneToSubjectScope,
} from "@/lib/assessment/v2/definition";
import type { AssessmentItem, SubjectSelection } from "@/lib/assessment/v2/types";
import { v2SubmissionSchema } from "@/lib/assessment/v2/validation";
import { submitPublicSurveyV2 } from "@/lib/actions/public-survey-v2";
import { ScoreQuestion, type ScoreValue } from "./score-question";
import {
  emptyIntake,
  INTAKE_SCREEN_COUNT,
  IntakeScreen,
  isIntakeScreenComplete,
  type IntakeState,
} from "./intake-screens";

const STORAGE_KEY = "nk-survey-v2";
const AUTO_ADVANCE_MS = 520; // §7 460~620ms 범위.
const AUTO_ADVANCE_MS_REDUCED = 200;

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

  // ── sessionStorage 복원(최초 1회) ──
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<PersistedState>;
        if (p.intake) setIntake({ ...emptyIntake(), ...p.intake });
        if (p.responses) setResponses(p.responses);
        if (p.scenarios) setScenarios(p.scenarios);
        if (p.supplements) setSupplements(p.supplements);
        if (typeof p.commitment14 === "string") setCommitment14(p.commitment14);
        if (typeof p.index === "number") setIndex(p.index);
      }
    } catch {
      // 손상된 저장값은 무시하고 새로 시작한다.
    }
    setHydrated(true);
  }, []);

  // ── sessionStorage 저장(제출 후에는 저장하지 않음) ──
  useEffect(() => {
    if (!hydrated || submitted) return;
    try {
      const payload: PersistedState = {
        intake,
        responses,
        scenarios,
        supplements,
        commitment14,
        index,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // 용량 초과 등은 무시(진행은 계속 가능).
    }
  }, [hydrated, submitted, intake, responses, scenarios, supplements, commitment14, index]);

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

  // ── 점수 문항 선택 처리(자동 이동 판단 포함) ──
  const handleSelect = useCallback(
    (value: ScoreValue, viaPointer: boolean) => {
      if (!currentItem) return;
      const meta = (itemMetaRef.current[currentItem.id] ??= {});
      const now = Date.now();
      if (meta.firstSelectAt === undefined) meta.firstSelectAt = now;
      meta.lastEditAt = now;

      const scenario = isChoiceItem(currentItem);
      const hadValue = scenario
        ? scenarios[currentItem.id] !== undefined
        : responses[currentItem.id] !== undefined;

      if (scenario) {
        setScenarios((s) => ({ ...s, [currentItem.id]: value as number }));
      } else {
        setResponses((s) => ({ ...s, [currentItem.id]: value }));
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
    [currentItem, scenarios, responses, totalScreens]
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
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          /* noop */
        }
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

  // ── 진행 표시(§7: 번호/전체/진행률만) ──
  const progressPercent = Math.round((index / (totalScreens - 1)) * 100);
  const progressLabel =
    phase === "score"
      ? `${scoreIdx + 1} / ${scoreCount} 문항`
      : phase === "commitment"
        ? "마무리"
        : "기본 정보 입력";

  const answered = isCurrentAnswered();
  const isCommitment = phase === "commitment";

  return (
    <div className="space-y-5">
      {/* 진행 표시 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-foreground">{progressLabel}</span>
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
            className="h-11 rounded-xl bg-primary px-6 font-semibold text-primary-foreground"
          >
            다음
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

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
      <textarea
        id="v2-commitment14"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="예: 매일 학원 오기 전 수학 오답 1개를 다시 풀어보겠습니다."
        className="w-full resize-none rounded-xl border border-border bg-card px-3.5 py-2.5 text-[14px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
      />
      <p className="text-[12px] text-muted-foreground">
        작성한 약속은 첫 상담과 2주 뒤 확인에 활용됩니다.
      </p>
    </div>
  );
}
