// @ts-nocheck
"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, X, Loader2, RotateCcw, MessageSquare } from "lucide-react";

interface Props {
  userName: string;
}

const WELCOME_MSG = (name: string) =>
  `안녕하세요, ${name}님! NK AI 어시스턴트입니다.\n\n무엇이든 물어보세요:\n- "이번달 상담 현황 알려줘"\n- "재원생 몇 명이야?"\n- "홍길동 학생 설문 분석해줘"\n- "최근 퇴원생 목록 보여줘"`;

export function ChatPopup({ userName }: Props) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const { messages, isLoading, setMessages, append } = useChat({
    api: "/api/chat",
  });

  // 웰컴 메시지 초기화
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant" as const,
          content: WELCOME_MSG(userName),
          parts: [{ type: "text" as const, text: WELCOME_MSG(userName) }],
        },
      ]);
    }
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue("");
    append({ role: "user", content: text });
  }, [inputValue, isLoading, append]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = useCallback(() => {
    setInputValue("");
    setMessages([
      {
        id: "welcome",
        role: "assistant" as const,
        content: WELCOME_MSG(userName),
        parts: [{ type: "text" as const, text: WELCOME_MSG(userName) }],
      },
    ]);
  }, [setMessages, userName]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
        style={{
          background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
          boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
        }}
      >
        <MessageSquare className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col w-[420px] h-[600px] rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
      style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}
    >
      {/* 헤더 */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="text-sm font-semibold">NK AI 어시스턴트</div>
            <div className="text-[10px] text-white/60">대표/원장 전용</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleReset} className="p-1.5 rounded-lg hover:bg-white/10 transition" title="대화 초기화">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition" title="닫기">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50">
        {messages.map((msg) => {
          const content = msg.content || "";
          return (
            <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div
                className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${
                  msg.role === "user" ? "bg-blue-100 text-blue-600" : "bg-violet-100 text-violet-600"
                }`}
              >
                {msg.role === "user" ? userName[0] : <Bot className="w-3.5 h-3.5" />}
              </div>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "bg-white text-slate-700 border border-slate-200 rounded-tl-sm shadow-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div
                    className="prose prose-sm prose-slate max-w-none [&_table]:text-xs [&_table]:w-full [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_th]:text-left [&_table]:border-collapse [&_th]:border [&_td]:border [&_th]:border-slate-300 [&_td]:border-slate-200 [&_p]:my-1 [&_li]:my-0.5"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                  />
                ) : (
                  <span className="whitespace-pre-wrap">{content}</span>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-violet-600" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl rounded-tl-sm px-3 py-2.5 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                생각하는 중...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 입력 */}
      <div className="px-3 py-2.5 border-t bg-white">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지 입력... (Enter 전송)"
            rows={1}
            className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 max-h-24 overflow-y-auto"
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
            style={{ background: "#7C3AED", color: "white" }}
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
  let html = text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-slate-100 rounded-lg p-2 overflow-x-auto text-xs my-1"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-xs">$1</code>')
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
