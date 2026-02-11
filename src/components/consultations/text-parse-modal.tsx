"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { parseAndCreateConsultations } from "@/lib/actions/consultation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TextParseModal({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleParse = () => {
    if (!text.trim()) {
      toast.error("텍스트를 입력해주세요");
      return;
    }

    startTransition(async () => {
      const result = await parseAndCreateConsultations(text);

      if (result.success) {
        toast.success(`${result.count}건이 등록되었습니다`);
        setText("");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error || "파싱 중 오류가 발생했습니다");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>카카오톡 텍스트 파싱</DialogTitle>
          <DialogDescription>
            카카오톡 형식의 상담 안내 텍스트를 붙여넣기하면 자동으로
            파싱하여 등록합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder={`[NK test 안내]\n이름 : 홍길동\n학교 : OO중(중1)\n연락처 : 010-1234-5678\n일시 : 2월 10일 오후 5시\n테스트 과목 : 수학\n위치 : NK학원(폴리타운 B동 4층)\n학부모님 상담 : 유선 상담`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[250px] font-mono text-sm"
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button onClick={handleParse} disabled={isPending || !text.trim()}>
              {isPending ? "처리 중..." : "일괄 등록"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
