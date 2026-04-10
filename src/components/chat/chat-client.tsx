// @ts-nocheck
"use client";

import { useChat } from "@ai-sdk/react";
import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Bot, User, Loader2, RotateCcw } from "lucide-react";

interface Props {
  userName: string;
}

export function ChatClient({ userName }: Props) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, reload, setMessages } =
    useChat({
      api: "/api/chat",
      initialMessages: [
        {
          id: "welcome",
          role: "assistant",
          content: `안녕하세요, ${userName}님! NK 상담관리 AI 어시스턴트입니다.\n\n무엇이든 물어보세요. 예를 들어:\n- "이번달 상담 현황 알려줘"\n- "재원생 몇 명이야?"\n- "최근 퇴원생 분석해줘"\n- "홍길동 학생 설문 결과 보여줘"`,
        },
      ],
    });

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 새 메시지 시 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 엔터로 전송 (Shift+Enter는 줄바꿈)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 text-sm">NK AI 어시스턴트</h2>
            <p className="text-xs text-slate-500">대표/원장 전용 · Claude Sonnet</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMessages([messages[0]])}
          className="text-slate-400 hover:text-slate-600"
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          초기화
        </Button>
      </div>

      {/* 메시지 영역 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            {/* 아바타 */}
            <div
              className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                msg.role === "user"
                  ? "bg-blue-100"
                  : "bg-violet-100"
              }`}
            >
              {msg.role === "user" ? (
                <User className="w-4 h-4 text-blue-600" />
              ) : (
                <Bot className="w-4 h-4 text-violet-600" />
              )}
            </div>

            {/* 메시지 버블 */}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-tr-sm"
                  : "bg-white text-slate-700 border border-slate-200 rounded-tl-sm shadow-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                <div
                  className="prose prose-sm prose-slate max-w-none [&_table]:text-xs [&_table]:w-full [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_th]:text-left [&_table]:border-collapse [&_th]:border [&_td]:border [&_th]:border-slate-300 [&_td]:border-slate-200"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(msg.content),
                  }}
                />
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
            </div>
          </div>
        ))}

        {/* 로딩 인디케이터 */}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-violet-600" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                생각하는 중...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 입력 영역 */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 border-t bg-white rounded-b-xl"
      >
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 max-h-32 overflow-y-auto"
            style={{ minHeight: "44px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 128) + "px";
            }}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="h-11 w-11 rounded-xl bg-violet-600 hover:bg-violet-700 flex-shrink-0"
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

// 간단한 마크다운 → HTML 변환
function renderMarkdown(text: string): string {
  let html = text
    // 코드 블록
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-slate-100 rounded-lg p-3 overflow-x-auto text-xs"><code>$2</code></pre>')
    // 인라인 코드
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-xs">$1</code>')
    // 굵게
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // 기울임
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // 헤딩
    .replace(/^### (.+)$/gm, '<h3 class="font-bold text-base mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-bold text-lg mt-4 mb-2">$1</h2>')
    // 마크다운 표
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match
        .split("|")
        .filter((c) => c.trim() !== "");
      if (cells.every((c) => /^[\s-:]+$/.test(c))) return "<!--sep-->";
      return cells.map((c) => `<td>${c.trim()}</td>`).join("");
    });

  // 표 조립
  const lines = html.split("\n");
  let inTable = false;
  let isHeader = true;
  const result: string[] = [];

  for (const line of lines) {
    if (line.includes("<td>") && !inTable) {
      inTable = true;
      isHeader = true;
      result.push('<table class="my-2"><thead><tr>');
      result.push(line.replace(/<td>/g, "<th>").replace(/<\/td>/g, "</th>"));
      result.push("</tr></thead><tbody>");
    } else if (line === "<!--sep-->") {
      isHeader = false;
    } else if (line.includes("<td>") && inTable) {
      result.push(`<tr>${line}</tr>`);
    } else {
      if (inTable) {
        result.push("</tbody></table>");
        inTable = false;
      }
      // 리스트
      if (/^[-*] (.+)/.test(line)) {
        result.push(`<li class="ml-4 list-disc">${line.replace(/^[-*] /, "")}</li>`);
      } else if (/^\d+\. (.+)/.test(line)) {
        result.push(
          `<li class="ml-4 list-decimal">${line.replace(/^\d+\. /, "")}</li>`
        );
      } else if (line.trim() === "") {
        result.push("<br/>");
      } else {
        result.push(`<p>${line}</p>`);
      }
    }
  }
  if (inTable) result.push("</tbody></table>");

  return result.join("\n");
}
