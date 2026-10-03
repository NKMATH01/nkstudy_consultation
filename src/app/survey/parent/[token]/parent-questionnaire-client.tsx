"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Clock3, Link2Off, Loader2, Send } from "lucide-react";
import { submitParentQuestionnaire } from "@/lib/actions/parent-questionnaire";
import {
  PARENT_QUESTIONNAIRE_QUESTIONS,
  PARENT_QUESTIONNAIRE_TEXT_MAX,
  parentQuestionnaireAnswersSchema,
  type ParentQuestion,
  type QuestionnaireTokenState,
} from "@/lib/parent-questionnaire/questions";

// 색은 NK 공통 토큰(--wr-*)으로만. 이 화면은 /survey 레이아웃(data-theme="day")에서 라이트로 고정된다.
const C = {
  navy: "rgb(var(--wr-navy))",
  navyInk: "rgb(var(--wr-navy-ink))",
  navySoft: "rgb(var(--wr-navy-soft))",
  brass: "rgb(var(--wr-brass))",
  brassSoft: "rgb(var(--wr-brass-soft))",
  surface: "rgb(var(--wr-surface))",
  sunken: "rgb(var(--wr-sunken))",
  line: "rgb(var(--wr-line))",
  ink: "rgb(var(--wr-ink))",
  inkSub: "rgb(var(--wr-ink-sub))",
  inkHint: "rgb(var(--wr-ink-hint))",
  danger: "rgb(var(--wr-danger))",
  dangerSoft: "rgb(var(--wr-danger-soft))",
  done: "rgb(var(--wr-status-done))",
  doneSoft: "rgb(var(--wr-status-done-soft))",
} as const;

type FormState = Record<string, string>;

function Card({
  children,
  id,
  highlighted = false,
}: {
  children: React.ReactNode;
  id?: string;
  /** 빠진 필수 문항 강조(제출 시도 후). */
  highlighted?: boolean;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-4 rounded-2xl p-5 shadow-sm transition-shadow"
      style={{
        background: C.surface,
        border: `1px solid ${highlighted ? C.danger : C.line}`,
        boxShadow: highlighted ? `0 0 0 3px ${C.dangerSoft}` : undefined,
      }}
    >
      {children}
    </section>
  );
}

// ── 안내 화면(만료·회수·이미 답함·없는 링크) ───────────────────────────────

const NOTICE: Record<Exclude<QuestionnaireTokenState, "open">, { title: string; message: string }> = {
  not_found: {
    title: "질문지를 찾을 수 없습니다",
    message: "링크 주소가 정확한지 확인해 주세요. 계속 열리지 않으면 학원으로 연락 주시면 새 링크를 보내 드리겠습니다.",
  },
  revoked: {
    title: "더 이상 사용하지 않는 링크입니다",
    message: "새 질문지 링크가 따로 안내되었을 수 있습니다. 궁금하신 점은 학원으로 연락 주세요.",
  },
  answered: {
    title: "이미 작성해 주셨습니다",
    message: "보내 주신 답변은 상담 준비에 잘 활용하겠습니다. 고맙습니다.",
  },
  expired: {
    title: "작성 기간이 지났습니다",
    message: "질문지는 안내 후 30일 동안 열려 있습니다. 다시 작성하시려면 학원으로 연락 주세요.",
  },
};

export function ParentQuestionnaireNotice({
  state,
}: {
  state: Exclude<QuestionnaireTokenState, "open">;
}) {
  const { title, message } = NOTICE[state];
  const Icon = state === "answered" ? CheckCircle2 : state === "expired" ? Clock3 : Link2Off;
  const good = state === "answered";
  return (
    <Card>
      <div className="py-4 text-center">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: good ? C.doneSoft : C.sunken, color: good ? C.done : C.inkSub }}
        >
          <Icon className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-lg font-bold tracking-tight" style={{ color: C.ink }}>
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6" style={{ color: C.inkSub }}>
          {message}
        </p>
        <p className="mt-5 text-xs" style={{ color: C.inkHint }}>
          NK EDUCATION 031-401-8102
        </p>
      </div>
    </Card>
  );
}

// ── 감사 화면 ───────────────────────────────────────────────────────────

function ThankYou({ studentName }: { studentName: string }) {
  return (
    <Card>
      <div className="py-6 text-center">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: C.doneSoft, color: C.done }}
        >
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-lg font-bold tracking-tight" style={{ color: C.ink }}>
          작성해 주셔서 고맙습니다
        </h1>
        <p className="mt-2 text-sm leading-6" style={{ color: C.inkSub }}>
          {studentName ? `${studentName} 학생 ` : ""}상담 때 보내 주신 답변을 바탕으로
          <br />더 정확하게 말씀드리겠습니다.
        </p>
        <p className="mt-5 text-xs" style={{ color: C.inkHint }}>
          이 창은 닫으셔도 됩니다.
        </p>
      </div>
    </Card>
  );
}

// ── 문항 ────────────────────────────────────────────────────────────────

function OptionButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="min-h-11 rounded-xl px-4 py-2.5 text-left text-[15px] font-medium transition-colors"
      style={{
        background: selected ? C.navy : C.surface,
        color: selected ? C.navyInk : C.ink,
        border: `1px solid ${selected ? C.navy : C.line}`,
      }}
    >
      {label}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  background: C.surface,
  color: C.ink,
  border: `1px solid ${C.line}`,
};

const questionCardId = (key: string) => `pq-question-${key}`;

/** 아직 고르지 않은 필수(선택형) 문항들, 화면 순서대로. */
function findMissingChoiceQuestions(form: FormState): ParentQuestion[] {
  return PARENT_QUESTIONNAIRE_QUESTIONS.filter((q) => q.kind === "choice" && !form[q.key]);
}

function missingQuestionMessage(missing: ParentQuestion[]): string {
  const first = missing[0];
  return missing.length === 1
    ? `${first.no}번 문항을 골라 주세요`
    : `${first.no}번 외 ${missing.length - 1}개 문항을 골라 주세요`;
}

function QuestionBlock({
  question,
  form,
  setField,
  highlighted,
}: {
  question: ParentQuestion;
  form: FormState;
  setField: (key: string, value: string) => void;
  highlighted: boolean;
}) {
  return (
    <Card id={questionCardId(question.key)} highlighted={highlighted}>
      <div className="mb-3 flex items-start gap-2.5">
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{ background: C.brassSoft, color: C.brass }}
        >
          {question.no}
        </span>
        <h2 className="text-[15px] font-semibold leading-6" style={{ color: C.ink }}>
          {question.q}
          {question.kind !== "choice" && (
            <span className="ml-1 text-xs font-normal" style={{ color: C.inkHint }}>
              (선택)
            </span>
          )}
        </h2>
      </div>

      {question.kind === "choice" && (
        <div className="grid gap-2">
          {question.options.map((opt) => (
            <OptionButton
              key={opt}
              label={opt}
              selected={form[question.key] === opt}
              onClick={() => setField(question.key, opt)}
            />
          ))}
          {question.other && form[question.key] === question.other.when && (
            <input
              type="text"
              value={form[question.other.key] ?? ""}
              onChange={(e) => setField(question.other!.key, e.target.value)}
              maxLength={PARENT_QUESTIONNAIRE_TEXT_MAX}
              placeholder={`${question.other.label}를 적어 주세요`}
              className="mt-1 h-11 rounded-xl px-3 text-[15px] outline-none"
              style={inputStyle}
            />
          )}
        </div>
      )}

      {question.kind === "text" && (
        <div>
          <textarea
            value={form[question.key] ?? ""}
            onChange={(e) => setField(question.key, e.target.value)}
            maxLength={PARENT_QUESTIONNAIRE_TEXT_MAX}
            rows={3}
            placeholder={question.placeholder}
            className="w-full resize-none rounded-xl px-3 py-2.5 text-[15px] leading-6 outline-none"
            style={inputStyle}
          />
          <p className="mt-1 text-right text-xs" style={{ color: C.inkHint }}>
            {(form[question.key] ?? "").length}/{PARENT_QUESTIONNAIRE_TEXT_MAX}
          </p>
        </div>
      )}

      {question.kind === "scores" && (
        <div className="grid grid-cols-2 gap-3">
          {question.fields.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-sm" style={{ color: C.inkSub }}>
                {f.label}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={1}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder="0~100"
                  className="h-11 w-full rounded-xl px-3 text-[15px] outline-none"
                  style={inputStyle}
                />
                <span className="text-sm" style={{ color: C.inkSub }}>
                  점
                </span>
              </div>
            </label>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── 본체 ────────────────────────────────────────────────────────────────

export function ParentQuestionnaireClient({
  token,
  studentName,
  initialSubmitted = false,
}: {
  token: string;
  studentName: string;
  /** 미리보기·검증용. 실제 화면은 false. */
  initialSubmitted?: boolean;
}) {
  const [form, setForm] = useState<FormState>({});
  const [error, setError] = useState<string | null>(null);
  const [missingKeys, setMissingKeys] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(initialSubmitted);
  const [blockedState, setBlockedState] = useState<Exclude<QuestionnaireTokenState, "open"> | null>(null);
  const [isPending, startTransition] = useTransition();

  const setField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
    setMissingKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : prev));
  };

  if (submitted) return <ThankYou studentName={studentName} />;
  if (blockedState) return <ParentQuestionnaireNotice state={blockedState} />;

  const handleSubmit = () => {
    const missing = findMissingChoiceQuestions(form);
    if (missing.length > 0) {
      setMissingKeys(missing.map((q) => q.key));
      setError(missingQuestionMessage(missing));
      document
        .getElementById(questionCardId(missing[0].key))
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setMissingKeys([]);

    const parsed = parentQuestionnaireAnswersSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "응답을 확인해 주세요.");
      return;
    }

    startTransition(async () => {
      const result = await submitParentQuestionnaire(token, form);
      if (result.success) {
        setSubmitted(true);
        return;
      }
      if (result.state && result.state !== "open") {
        setBlockedState(result.state);
        return;
      }
      setError(result.error ?? "제출에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    });
  };

  return (
    <div className="space-y-4 pb-8">
      <header className="px-1">
        <p className="text-xs font-semibold tracking-wide" style={{ color: C.brass }}>
          학부모 질문지 · 8문항
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight" style={{ color: C.ink }}>
          {studentName ? `${studentName} 학생 학부모님` : "학부모님"}, 안녕하세요
        </h1>
        <p className="mt-2 text-sm leading-6" style={{ color: C.inkSub }}>
          상담 전에 학부모님 생각을 알려 주시면 상담이 더 정확해집니다. 3분이면 충분합니다.
        </p>
      </header>

      {PARENT_QUESTIONNAIRE_QUESTIONS.map((q) => (
        <QuestionBlock
          key={q.key}
          question={q}
          form={form}
          setField={setField}
          highlighted={missingKeys.includes(q.key)}
        />
      ))}

      {error && (
        <p
          role="alert"
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: C.dangerSoft, color: C.danger }}
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold disabled:opacity-60"
        style={{ background: C.navy, color: C.navyInk }}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Send className="h-4 w-4" aria-hidden />
        )}
        제출하기
      </button>
      <p className="text-center text-xs" style={{ color: C.inkHint }}>
        제출은 한 번만 할 수 있습니다.
      </p>
    </div>
  );
}
