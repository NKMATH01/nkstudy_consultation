"use client";

// 상담이 아닌 문서(등록안내·성향분석 결과지)를 알림톡으로 보낼 때 쓰는 공용 미리보기/발송 다이얼로그.
// consultation-list-client의 발송 흐름과 동일한 검증 규칙을 따른다.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { previewAlimtalk, sendAlimtalk } from "@/lib/actions/alimtalk";

type PreviewData = {
  template: { kakao_status: string };
  text: string;
  missing: string[];
  maskedPhone: string;
  sendable: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 다이얼로그를 열 때 토큰 생성 등을 마치고 발송 인자를 만든다. null이면 실패로 처리한다. */
  prepare: () => Promise<{
    templateCode: string;
    phone: string;
    vars: Record<string, string>;
    subjectType: string;
    subjectId: string;
  } | null>;
  targetLabel: string;
  title?: string;
};

type PreviewState = {
  loading: boolean;
  data: PreviewData | null;
  error: string | null;
};

type SendArgs = Awaited<ReturnType<Props["prepare"]>>;

const EMPTY_PREVIEW: PreviewState = { loading: false, data: null, error: null };

export function AlimtalkSendDialog({
  open,
  onOpenChange,
  prepare,
  targetLabel,
  title = "알림톡 발송 미리보기",
}: Props) {
  const [preview, setPreview] = useState<PreviewState>(EMPTY_PREVIEW);
  const [sendArgs, setSendArgs] = useState<SendArgs>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setPreview(EMPTY_PREVIEW);
      setSendArgs(null);
      return;
    }

    let cancelled = false;
    setPreview({ loading: true, data: null, error: null });

    void (async () => {
      const args = await prepare();
      if (cancelled) return;

      if (!args) {
        setPreview({ loading: false, data: null, error: "발송 준비에 실패했습니다" });
        return;
      }

      const result = await previewAlimtalk({
        templateCode: args.templateCode,
        phone: args.phone,
        vars: args.vars,
      });
      if (cancelled) return;

      if (!result.success || !result.data) {
        setPreview({
          loading: false,
          data: null,
          error: result.error ?? "미리보기 실패",
        });
        return;
      }

      setSendArgs(args);
      setPreview({ loading: false, data: result.data, error: null });
    })();

    return () => {
      cancelled = true;
    };
  }, [open, prepare]);

  const handleClose = useCallback(
    (next: boolean) => {
      if (next || sending) return;
      onOpenChange(false);
    },
    [onOpenChange, sending],
  );

  const handleSend = useCallback(async () => {
    if (!sendArgs) return;
    setSending(true);
    try {
      const result = await sendAlimtalk({
        templateCode: sendArgs.templateCode,
        phone: sendArgs.phone,
        vars: sendArgs.vars,
        subjectType: sendArgs.subjectType,
        subjectId: sendArgs.subjectId,
        allowSmsFallback: true,
      });

      if (!result.success) {
        toast.error(result.error ?? "발송 실패");
        return;
      }

      toast.success("알림톡 발송 완료");
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  }, [onOpenChange, sendArgs]);

  const missing = preview.data?.missing ?? [];
  const templateUnapproved =
    !!preview.data && preview.data.template.kakao_status !== "approved";
  const sendDisabled =
    sending ||
    preview.loading ||
    !!preview.error ||
    !preview.data ||
    !preview.data.sendable ||
    missing.length > 0 ||
    templateUnapproved;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            대상:{" "}
            <span className="font-semibold text-slate-900">
              {targetLabel} · {preview.data?.maskedPhone ?? "-"} · 1명
            </span>
          </div>

          {preview.loading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-center text-sm text-slate-500">
              미리보기를 불러오는 중입니다.
            </div>
          ) : preview.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
              {preview.error}
            </div>
          ) : (
            <div className="rounded-lg bg-[#FEE500] p-4 text-sm leading-6 text-slate-950 shadow-sm">
              <div className="whitespace-pre-wrap">{preview.data?.text ?? ""}</div>
            </div>
          )}

          {missing.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
              미치환 변수: {missing.join(", ")}
            </div>
          )}

          {templateUnapproved && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
              카카오 승인 대기 — 템플릿이 승인되어야 발송할 수 있습니다
            </div>
          )}

          {preview.data &&
            !preview.data.sendable &&
            missing.length === 0 &&
            !templateUnapproved && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
                대상 전화번호를 확인해 주세요
              </div>
            )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => handleClose(false)}
            disabled={sending}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sendDisabled}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {sending ? "발송 중" : "발송하기"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
