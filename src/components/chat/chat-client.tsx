"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, X, Loader2, RotateCcw, MessageSquare } from "lucide-react";
import { ConfirmationCard } from "./confirmation-card";
import type { Proposal } from "@/lib/chat-tools";

interface ToolResult {
  status: string;
  proposal?: Proposal;
  entityLabel?: string;
  operationLabel?: string;
  summary?: string;
  message?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolResults?: ToolResult[];
}

interface Props {
  userName: string;
}

const WELCOME_MSG = (name: string) =>
  `안녕하세요, ${name}님! NK AI 어시스턴트입니다.\n\n무엇이든 물어보세요:\n- "이번달 상담 현황 알려줘"\n- "재원생 몇 명이야?"\n- "홍길동 학생 상담 메모 수정해줘"\n- "새 상담 등록해줘"`;

const TOOL_RESULT_REGEX = /<!--TOOL_RESULT:(.*?)-->/g;

/** 텍스트에서 도구 결과 마커를 추출하고 제거 */
function extractToolResults(text: string): { cleanText: string; toolResults: ToolResult[] } {
  const toolResults: ToolResult[] = [];
  let match;
  while ((match = TOOL_RESULT_REGEX.exec(text)) !== null) {
    try {
      toolResults.push(JSON.parse(match[1]));
    } catch { /* ignore parse errors */ }
  }
  const cleanText = text.replace(TOOL_RESULT_REGEX, "").trim();
  return { cleanText, toolResults };
}

async function executeProposal(proposal: Proposal): Promise<{ success: boolean; message: string }> {
  const res = await fetch("/api/chat/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proposal }),
  });
  return res.json();
}

export function ChatPopup({ userName }: Props) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: WELCOME_MSG(userName) },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue("");
    setIsLoading(true);

    try {
      abortRef.current = new AbortController();

      // API에 보낼 메시지 (welcome 제외)
      const apiMessages = newMessages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${res.status}: ${errText}`);
      }

      // 전체 응답 텍스트 수신
      const rawText = await res.text();
      const assistantId = (Date.now() + 1).toString();

      // 도구 결과 추출
      const { cleanText, toolResults } = extractToolResults(rawText);

      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: cleanText || (toolResults.length > 0 ? "" : "응답을 생성하지 못했습니다. 다시 시도해주세요."),
          toolResults: toolResults.length > 0 ? toolResults : undefined,
        },
      ]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const errMsg = err instanceof Error ? err.message : "알 수 없는 오류";
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 2).toString(), role: "assistant", content: `오류가 발생했습니다: ${errMsg}` },
      ]);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [inputValue, isLoading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    if (abortRef.current) abortRef.current.abort();
    setInputValue("");
    setIsLoading(false);
    setMessages([{ id: "welcome", role: "assistant", content: WELCOME_MSG(userName) }]);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
        style={{
          background: "linear-gradient(135deg, rgb(var(--wr-cat-3)), rgb(var(--wr-cat-3)))",
          boxShadow: "0 4px 20px rgb(var(--wr-cat-3) / 0.4)",
        }}
      >
        <MessageSquare className="w-6 h-6 text-nk-navy-ink" />
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col w-[420px] h-[600px] rounded-2xl shadow-2xl overflow-hidden border border-nk-line-soft"
      style={{ boxShadow: "0 8px 40px rgb(var(--wr-navy-strong) / 0.15)" }}
    >
      {/* 헤더 */}
      <div
        className="flex items-center justify-between px-4 py-3 text-nk-navy-ink"
        style={{ background: "linear-gradient(135deg, rgb(var(--wr-cat-3)), rgb(var(--wr-cat-3)))" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-nk-surface/20 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">NK AI 어시스턴트</div>
            <div className="text-[10px] text-nk-navy-ink/60">대표/원장 전용</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleReset} className="p-1.5 rounded-lg hover:bg-nk-surface/10 transition" title="대화 초기화">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-nk-surface/10 transition" title="닫기">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-nk-sunken">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${
                msg.role === "user" ? "bg-nk-progress-soft text-nk-progress" : "bg-nk-cat-3-soft text-nk-cat-3"
              }`}
            >
              {msg.role === "user" ? userName[0] : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div className="max-w-[85%] space-y-1">
              {/* 텍스트 내용 */}
              {msg.content && (
                <div
                  className={`rounded-xl px-3 py-2.5 text-[13px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-nk-progress text-nk-navy-ink rounded-tr-sm"
                      : "bg-nk-surface text-nk-ink border border-nk-line-soft rounded-tl-sm shadow-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div
                      className="prose prose-sm prose-slate max-w-none [&_table]:text-xs [&_table]:w-full [&_th]:bg-nk-sunken [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_th]:text-left [&_table]:border-collapse [&_th]:border [&_td]:border [&_th]:border-nk-line [&_td]:border-nk-line-soft [&_p]:my-1 [&_li]:my-0.5"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>
              )}

              {/* 도구 결과: 확인 카드 렌더링 */}
              {msg.toolResults?.map((tr, idx) => {
                if (tr.status === "pending_confirmation" && tr.proposal) {
                  return (
                    <ConfirmationCard
                      key={`tool-${msg.id}-${idx}`}
                      proposal={tr.proposal}
                      entityLabel={tr.entityLabel || ""}
                      operationLabel={tr.operationLabel || ""}
                      summary={tr.summary || ""}
                      onConfirm={executeProposal}
                      onCancel={() => {}}
                    />
                  );
                }
                if (tr.status === "error") {
                  return (
                    <div key={`tool-${msg.id}-${idx}`} className="text-xs text-nk-late bg-nk-late-soft rounded-lg px-3 py-2 border border-nk-late">
                      {tr.message}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-nk-cat-3-soft flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-nk-cat-3" />
            </div>
            <div className="bg-nk-surface border border-nk-line-soft rounded-xl rounded-tl-sm px-3 py-2.5 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-nk-ink-sub">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                생각하는 중...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 입력 */}
      <div className="px-3 py-2.5 border-t bg-nk-surface">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지 입력... (Enter 전송)"
            rows={1}
            className="flex-1 resize-none rounded-lg border border-nk-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nk-cat-3 max-h-24 overflow-y-auto"
            style={{ minHeight: "38px" }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 96) + "px";
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="h-[38px] w-[38px] rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition"
            style={{ background: "rgb(var(--wr-cat-3))", color: "white" }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function renderMarkdown(text: string): string {
  if (!text) return "";
  const html = text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-nk-sunken rounded-lg p-2 overflow-x-auto text-xs my-1"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-nk-sunken px-1 py-0.5 rounded text-xs">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, '<h3 class="font-bold text-sm mt-2 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-bold text-base mt-3 mb-1">$1</h2>');

  const lines = html.split("\n");
  let inTable = false;
  const result: string[] = [];

  for (const line of lines) {
    const cells = line.split("|").filter((c) => c.trim() !== "");
    const isTableRow = line.startsWith("|") && line.endsWith("|") && cells.length > 0;
    const isSepRow = isTableRow && cells.every((c) => /^[\s-:]+$/.test(c));

    if (isSepRow) continue;
    if (isTableRow && !inTable) {
      inTable = true;
      result.push("<table class='my-2'><thead><tr>");
      result.push(cells.map((c) => `<th>${c.trim()}</th>`).join(""));
      result.push("</tr></thead><tbody>");
    } else if (isTableRow && inTable) {
      result.push(`<tr>${cells.map((c) => `<td>${c.trim()}</td>`).join("")}</tr>`);
    } else {
      if (inTable) { result.push("</tbody></table>"); inTable = false; }
      if (/^[-*] (.+)/.test(line)) result.push(`<li class="ml-4 list-disc">${line.replace(/^[-*] /, "")}</li>`);
      else if (/^\d+\. (.+)/.test(line)) result.push(`<li class="ml-4 list-decimal">${line.replace(/^\d+\. /, "")}</li>`);
      else if (line.trim() === "") result.push("<br/>");
      else result.push(`<p>${line}</p>`);
    }
  }
  if (inTable) result.push("</tbody></table>");
  return result.join("\n");
}
