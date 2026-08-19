"use client";

// GNB 의 "오류·개선 제안" 버튼 + 4단계 모달.
// 기준 구현: 업무보고 저장소 components/program-feedback/program-feedback-button.tsx
//
// ★ 왜 AI 가 되묻는가
//   "그거 안 돼요" 한 줄로는 아무것도 못 고친다. 되묻는 일을 대표가 하면 하루가 지나고,
//   그 사이 제보자는 다른 방법으로 돌아가 재현 조건을 잊는다. 제보 직후 그 자리에서 끝낸다.
//
// ★ 단계는 넷이다: 유형 고르기 → 서술 → AI 되물음(최대 3턴) → 정리 확인 후 제출.
//   정리는 반드시 사람이 고칠 수 있어야 한다 — AI 가 잘못 요약한 채로 올라가면
//   되묻기를 자동화한 의미가 없어진다.
//
// ★ 앱의 다이얼로그·토스트에 기대지 않는다
//   같은 위젯이 8개 프로그램에 들어간다. UI 라이브러리가 앱마다 달라, 여기서는
//   공통 토큰(--wr-*)만 쓰는 자체 오버레이와 인라인 오류 줄로 맞춘다.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Bug, Lightbulb, LifeBuoy, Loader2, SendHorizonal, X } from "lucide-react";
import {
  KIND_LABELS,
  MAX_DETAIL_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_QUESTION_TURNS,
  MAX_REPORTER_NAME_LENGTH,
  MAX_SUMMARY_LENGTH,
  MAX_TITLE_LENGTH,
  PROGRAM_LABEL,
  SEVERITY_LABELS,
  requestInterview,
  submitFeedback,
  type FeedbackKind,
  type InterviewMessage,
  type Severity,
} from "@/lib/program-feedback";

/** done 은 제출 뒤 화면 — 모달을 바로 닫으면 접수됐는지 알 수 없다. */
type Step = "kind" | "talk" | "review" | "done";

interface Draft {
  title: string;
  summary: string;
  detail: string;
  severity: Severity | null;
}

export function ProgramFeedbackButton({ userName = "" }: { userName?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 전환 칩·Claude Code 버튼과 같은 문법(알약·아이콘+라벨). 색으로 튀게 하지 않는다. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="프로그램 오류 신고·개선 제안"
        className="nk-gnb__app"
      >
        <LifeBuoy size={14} strokeWidth={2} />
        오류·개선 제안
      </button>

      {open ? <FeedbackModal userName={userName} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function FeedbackModal({ userName, onClose }: { userName: string; onClose: () => void }) {
  const [step, setStep] = useState<Step>("kind");
  const [kind, setKind] = useState<FeedbackKind>("ERROR");
  const [reporterName, setReporterName] = useState(userName);
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const bodyRef = useRef<HTMLDivElement>(null);

  // Esc 로 닫는다 — 자체 오버레이라 브라우저가 대신 해 주지 않는다.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // 대화가 늘면 마지막 줄이 보이게 내린다.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages, draft, step]);

  /** 이력에 새 발언을 얹어 AI 에게 보낸다. */
  const send = useCallback(
    async (nextMessages: InterviewMessage[]) => {
      setBusy(true);
      setError("");
      try {
        const reply = await requestInterview(kind, nextMessages);

        if (reply.type === "question") {
          setMessages([...nextMessages, { role: "assistant", content: reply.question }]);
          return;
        }

        if (reply.type === "summary") {
          setDraft({
            title: reply.title,
            summary: reply.summary,
            detail: reply.detail,
            severity: reply.severity,
          });
          setStep("review");
          return;
        }

        // 형식이 깨졌다. 이력은 그대로 두고 사용자가 다시 누르게 한다.
        setError("정리에 실패했습니다. 한 번 더 보내 주세요.");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "연결에 실패했습니다.");
      } finally {
        setBusy(false);
      }
    },
    [kind],
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    const nextMessages: InterviewMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    await send(nextMessages);
  }, [busy, input, messages, send]);

  /** 되묻기를 건너뛰고 지금까지의 내용으로 정리를 요청한다. */
  const handleSummarizeNow = useCallback(async () => {
    if (busy || messages.length === 0) return;
    // 되물음 상한을 채운 이력으로 보내면 서버가 정리를 강제한다.
    const padded: InterviewMessage[] = [...messages];
    while (padded.filter((message) => message.role === "assistant").length < MAX_QUESTION_TURNS) {
      padded.push({ role: "assistant", content: "(추가 질문 생략)" });
    }
    await send(padded);
  }, [busy, messages, send]);

  const handleSubmit = useCallback(async () => {
    if (!draft || busy) return;
    if (!reporterName.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    if (!draft.title.trim() || !draft.summary.trim() || !draft.detail.trim()) {
      setError("제목·요약·상세를 모두 채워 주세요.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await submitFeedback({
        kind,
        reporterName: reporterName.trim(),
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        detail: draft.detail.trim(),
        severity: draft.severity,
        transcript: messages,
      });
      setStep("done");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "연결에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }, [busy, draft, kind, messages, reporterName]);

  const questionTurns = messages.filter((message) => message.role === "assistant").length;

  return (
    <div
      className="nk-pf__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="프로그램 오류 신고·개선 제안"
      onMouseDown={(event) => {
        // 배경을 눌렀을 때만 닫는다. 패널 안에서 드래그해 나온 경우는 닫지 않는다.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="nk-pf__panel">
        <div className="nk-pf__head">
          <p className="nk-pf__title">프로그램 오류 신고·개선 제안</p>
          <p className="nk-pf__hint">
            {step === "kind"
              ? "어떤 이야기인지 골라 주세요."
              : step === "talk"
                ? "접수 도우미가 몇 가지 되묻습니다. 아는 만큼만 답하면 됩니다."
                : step === "review"
                  ? "아래 내용이 대표에게 전달됩니다. 틀린 곳은 고쳐 주세요."
                  : "접수되었습니다."}
          </p>
          <button type="button" className="nk-pf__close" onClick={onClose} aria-label="닫기">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="nk-pf__body" ref={bodyRef}>
          {step === "kind" ? (
            <>
              <div className="nk-pf__kinds">
                <KindCard
                  active={kind === "ERROR"}
                  onClick={() => setKind("ERROR")}
                  icon={<Bug size={20} strokeWidth={2} />}
                  title={KIND_LABELS.ERROR}
                  description="눌렀는데 안 되거나, 잘못된 값이 보이거나, 저장이 안 되는 경우"
                />
                <KindCard
                  active={kind === "IMPROVE"}
                  onClick={() => setKind("IMPROVE")}
                  icon={<Lightbulb size={20} strokeWidth={2} />}
                  title={KIND_LABELS.IMPROVE}
                  description="되기는 하지만 불편하거나, 이렇게 바뀌면 좋겠다는 것"
                />
              </div>

              <div className="nk-pf__field">
                <label className="nk-pf__label" htmlFor="nk-pf-name">
                  이름
                </label>
                <input
                  id="nk-pf-name"
                  className="nk-pf__input"
                  value={reporterName}
                  maxLength={MAX_REPORTER_NAME_LENGTH}
                  onChange={(event) => setReporterName(event.target.value)}
                  placeholder="이름을 입력하세요"
                />
              </div>
            </>
          ) : null}

          {step === "talk" ? (
            <>
              <p className="nk-pf__meta">
                {PROGRAM_LABEL} · {KIND_LABELS[kind]}
              </p>

              {messages.length === 0 ? (
                <p className="nk-pf__empty">
                  {kind === "ERROR"
                    ? "어느 화면에서 무엇을 하다가 무슨 일이 생겼는지 편하게 적어 주세요."
                    : "지금 무엇이 불편하고 어떻게 바뀌면 좋을지 편하게 적어 주세요."}
                </p>
              ) : null}

              {messages.map((message, index) => (
                <p
                  key={`${message.role}-${index}`}
                  className={
                    message.role === "user"
                      ? "nk-pf__msg nk-pf__msg--user"
                      : "nk-pf__msg nk-pf__msg--ai"
                  }
                >
                  {message.content}
                </p>
              ))}

              {busy ? (
                <p className="nk-pf__busy">
                  <Loader2 className="nk-pf__spin" size={14} strokeWidth={2} />
                  접수 도우미가 읽는 중입니다
                </p>
              ) : null}
            </>
          ) : null}

          {step === "review" && draft ? (
            <>
              <p className="nk-pf__meta">
                {PROGRAM_LABEL} · {KIND_LABELS[kind]} · {reporterName || "이름 없음"}
              </p>

              <div className="nk-pf__field">
                <span className="nk-pf__label">제목</span>
                <input
                  className="nk-pf__input"
                  value={draft.title}
                  maxLength={MAX_TITLE_LENGTH}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                />
              </div>

              <div className="nk-pf__field">
                <span className="nk-pf__label">요약</span>
                <textarea
                  className="nk-pf__textarea"
                  rows={3}
                  value={draft.summary}
                  maxLength={MAX_SUMMARY_LENGTH}
                  onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
                />
              </div>

              <div className="nk-pf__field">
                <span className="nk-pf__label">
                  {kind === "ERROR" ? "상세 (재현 단계·기대vs실제)" : "상세 (현재→기대)"}
                </span>
                <textarea
                  className="nk-pf__textarea"
                  rows={7}
                  value={draft.detail}
                  maxLength={MAX_DETAIL_LENGTH}
                  onChange={(event) => setDraft({ ...draft, detail: event.target.value })}
                />
              </div>

              <div className="nk-pf__field">
                <span className="nk-pf__label">심각도</span>
                <div className="nk-pf__sevs">
                  {(["HIGH", "MEDIUM", "LOW"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setDraft({ ...draft, severity: level })}
                      className={
                        draft.severity === level ? "nk-pf__sev nk-pf__sev--on" : "nk-pf__sev"
                      }
                    >
                      {SEVERITY_LABELS[level]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {step === "done" ? (
            <p className="nk-pf__empty">
              접수되었습니다. 대표 의견함으로 전달됩니다. 확인 뒤 처리 결과를 알려 드립니다.
            </p>
          ) : null}

          {error ? <p className="nk-pf__error">{error}</p> : null}
        </div>

        <div className="nk-pf__foot">
          {step === "kind" ? (
            <>
              <span className="nk-pf__step">1 / 3 단계</span>
              <button
                type="button"
                className="nk-pf__primary"
                disabled={!reporterName.trim()}
                onClick={() => setStep("talk")}
              >
                다음
              </button>
            </>
          ) : null}

          {step === "talk" ? (
            <>
              <textarea
                className="nk-pf__textarea nk-pf__composer"
                rows={1}
                value={input}
                maxLength={MAX_MESSAGE_LENGTH}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  // Enter 로 보내고 Shift+Enter 로 줄바꿈 — 채팅과 같은 조작이다.
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="내용을 입력하고 Enter"
              />
              {questionTurns > 0 ? (
                <button
                  type="button"
                  className="nk-pf__ghost"
                  disabled={busy}
                  onClick={() => void handleSummarizeNow()}
                >
                  바로 정리
                </button>
              ) : null}
              <button
                type="button"
                className="nk-pf__send"
                disabled={busy || !input.trim()}
                aria-label="보내기"
                onClick={() => void handleSend()}
              >
                {busy ? (
                  <Loader2 className="nk-pf__spin" size={16} strokeWidth={2} />
                ) : (
                  <SendHorizonal size={16} strokeWidth={2} />
                )}
              </button>
            </>
          ) : null}

          {step === "review" ? (
            <>
              <button type="button" className="nk-pf__ghost" onClick={() => setStep("talk")}>
                더 설명하기
              </button>
              <span className="nk-pf__step" />
              <button
                type="button"
                className="nk-pf__primary"
                disabled={busy}
                onClick={() => void handleSubmit()}
              >
                {busy ? "제출 중…" : "제출"}
              </button>
            </>
          ) : null}

          {step === "done" ? (
            <>
              <span className="nk-pf__step" />
              <button type="button" className="nk-pf__primary" onClick={onClose}>
                닫기
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function KindCard({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  /** 아이콘은 만들어진 요소로 받는다 — lucide 의 타입이 버전마다 달라 컴포넌트로 받으면 앱마다 깨진다. */
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "nk-pf__kind nk-pf__kind--on" : "nk-pf__kind"}
    >
      {icon}
      <span className="nk-pf__kind-name">{title}</span>
      <span className="nk-pf__kind-desc">{description}</span>
    </button>
  );
}
